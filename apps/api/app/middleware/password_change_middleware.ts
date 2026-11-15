import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiError from '#exceptions/api_error'

/**
 * Enquanto must_change_password for true, só a troca de senha e o logout são permitidos.
 */
export default class PasswordChangeMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.auth.user!.mustChangePassword) {
      throw new ApiError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Troque a senha temporária para continuar.'
      )
    }
    return next()
  }
}
