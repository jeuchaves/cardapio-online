import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiError from '#exceptions/api_error'

/**
 * Perfil insuficiente: 403 (o vínculo já foi validado pelo middleware tenant).
 */
export default class OwnerOnlyMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.tenant.role !== 'owner') throw ApiError.forbidden()
    return next()
  }
}
