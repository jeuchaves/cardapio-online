import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import ApiError from '#exceptions/api_error'
import { validationError } from '#support/request_helpers'
import { changePasswordValidator, loginValidator } from '#validators/auth'
import { throttleLogin, throttlePasswordChange } from '#support/rate_limit'
import {
  endCurrentSession,
  revokeUserSessions,
  rotateSession,
  startSession,
} from '#support/session_control'

function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    is_platform_admin: user.isPlatformAdmin,
    must_change_password: user.mustChangePassword,
  }
}

// Somente vínculos ativos.
async function activeRestaurants(userId: string) {
  return db
    .from('restaurant_users')
    .join('restaurants', 'restaurants.id', 'restaurant_users.restaurant_id')
    .where('restaurant_users.user_id', userId)
    .where('restaurant_users.is_active', true)
    .orderBy('restaurants.name')
    .select('restaurants.id', 'restaurants.name', 'restaurants.slug', 'restaurant_users.role')
}

function invalidCredentials() {
  return new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(loginValidator)
    const normalizedEmail = User.normalizeEmail(email)

    // Conta toda tentativa, válida ou não, antes de verificar a senha.
    await throttleLogin(ctx.request.ip(), normalizedEmail)

    // Mensagem única: não revela se o e-mail existe, se a senha falhou ou se não há vínculo.
    const user = await User.findBy('email', normalizedEmail)
    const passwordOk = user
      ? await hash.verify(user.password, password)
      : await hash.make(password).then(() => false)
    if (!user || !passwordOk) throw invalidCredentials()

    const restaurants = await activeRestaurants(user.id)
    if (!user.isPlatformAdmin && restaurants.length === 0) throw invalidCredentials()

    await startSession(ctx, user)
    return { data: { user: serializeUser(user), restaurants } }
  }

  async logout(ctx: HttpContext) {
    await endCurrentSession(ctx)
    return ctx.response.noContent()
  }

  async me({ auth }: HttpContext) {
    const user = auth.user!
    return { data: { user: serializeUser(user), restaurants: await activeRestaurants(user.id) } }
  }

  async changePassword(ctx: HttpContext) {
    const user = ctx.auth.user!
    await throttlePasswordChange(user.id)

    const { current_password: current, new_password: next } =
      await ctx.request.validateUsing(changePasswordValidator)

    if (!(await hash.verify(user.password, current))) {
      throw validationError('current_password', 'Senha atual incorreta.')
    }
    if (next === current) {
      throw validationError('new_password', 'A nova senha deve ser diferente da atual.')
    }
    if (next.trim().toLowerCase() === user.email) {
      throw validationError('new_password', 'A senha não pode ser igual ao e-mail.')
    }

    user.password = next
    user.mustChangePassword = false
    await user.save()

    // Rotaciona o identificador (login_at preservado) e derruba as demais sessões.
    await rotateSession(ctx, user)
    await revokeUserSessions(user.id)
    return ctx.response.noContent()
  }
}
