import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Exige usuário autenticado pela sessão. A falha vira 401 UNAUTHENTICATED no handler.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.authenticateUsing(['web'])
    return next()
  }
}
