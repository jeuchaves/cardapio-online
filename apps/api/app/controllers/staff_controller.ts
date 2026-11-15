import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import RestaurantUser from '#models/restaurant_user'
import User from '#models/user'
import { audit } from '#support/audit'
import { isUniqueViolation, rejectUnknownFields, uuidParam } from '#support/request_helpers'
import { revokeUserSessions } from '#support/session_control'
import { generateTemporaryPassword } from '#support/temporary_password'
import { createStaffValidator, updateStaffValidator } from '#validators/restaurant'

function noStore({ response }: HttpContext) {
  response.header('Cache-Control', 'no-store')
}

/**
 * Vínculo de staff deste restaurante. Sem vínculo no restaurante: 404. Vínculo de owner:
 * 403 (D8: a equipe não altera owners). Filtra sempre por restaurant_id do tenant validado.
 */
async function findStaffLink({ tenant, params }: HttpContext) {
  const link = await RestaurantUser.query()
    .where('restaurant_id', tenant.restaurantId)
    .where('user_id', uuidParam(params.userId))
    .first()
  if (!link) throw ApiError.notFound()
  if (link.role !== 'staff') throw ApiError.forbidden()
  return link
}

/**
 * Evita tomada de conta: o owner só redefine senha (ou derruba sessões) de quem pertence
 * exclusivamente a este restaurante. Usuário com vínculo em outro restaurante, ou
 * platform_admin, é gerido pela plataforma.
 */
async function assertExclusiveToTenant(restaurantId: string, userId: string) {
  const user = await User.findOrFail(userId)
  const other = await RestaurantUser.query()
    .where('user_id', userId)
    .whereNot('restaurant_id', restaurantId)
    .first()
  if (user.isPlatformAdmin || other) throw ApiError.forbidden()
  return user
}

export default class StaffController {
  async index({ tenant }: HttpContext) {
    const rows = await db
      .from('restaurant_users')
      .join('users', 'users.id', 'restaurant_users.user_id')
      .where('restaurant_users.restaurant_id', tenant.restaurantId)
      .orderBy('users.name')
      .select(
        'users.id',
        'users.name',
        'users.email',
        'restaurant_users.role',
        'restaurant_users.is_active'
      )
    return { data: rows }
  }

  async store(ctx: HttpContext) {
    const { request, response, tenant, auth } = ctx
    rejectUnknownFields(request.body(), ['name', 'email'])
    const input = await request.validateUsing(createStaffValidator)
    const email = User.normalizeEmail(input.email)

    const emailTaken = () =>
      new ApiError(409, 'EMAIL_TAKEN', 'Já existe um usuário com este e-mail.')
    if (await User.findBy('email', email)) throw emailTaken()

    const temporaryPassword = generateTemporaryPassword()
    let user: User
    try {
      user = await db.transaction(async (trx) => {
        const created = await User.create(
          { name: input.name, email, password: temporaryPassword, mustChangePassword: true },
          { client: trx }
        )
        await RestaurantUser.create(
          { restaurantId: tenant.restaurantId, userId: created.id, role: 'staff' },
          { client: trx }
        )
        return created
      })
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_lower_unique')) throw emailTaken()
      throw error
    }

    audit(auth.user!.id, 'staff.create', { type: 'user', id: user.id })
    noStore(ctx)
    return response.status(201).send({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'staff',
        is_active: true,
        temporary_password: temporaryPassword,
      },
    })
  }

  async update(ctx: HttpContext) {
    const link = await findStaffLink(ctx)
    rejectUnknownFields(ctx.request.body(), ['is_active'])
    const { is_active: isActive } = await ctx.request.validateUsing(updateStaffValidator)

    link.isActive = isActive
    await link.save()
    // ADR 0002: desativar staff derruba as sessões do usuário afetado
    if (!isActive) await revokeUserSessions(link.userId)

    audit(ctx.auth.user!.id, isActive ? 'staff.activate' : 'staff.deactivate', {
      type: 'user',
      id: link.userId,
    })
    return { data: { id: link.userId, role: link.role, is_active: link.isActive } }
  }

  async resetPassword(ctx: HttpContext) {
    const link = await findStaffLink(ctx)
    const user = await assertExclusiveToTenant(link.restaurantId, link.userId)

    const temporaryPassword = generateTemporaryPassword()
    user.password = temporaryPassword
    user.mustChangePassword = true
    await user.save()
    await revokeUserSessions(user.id)

    audit(ctx.auth.user!.id, 'staff.reset_password', { type: 'user', id: user.id })
    noStore(ctx)
    return {
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        temporary_password: temporaryPassword,
      },
    }
  }
}
