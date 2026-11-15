import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiError from '#exceptions/api_error'
import { uuidParam } from '#support/request_helpers'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenant: { restaurantId: string; role: 'owner' | 'staff' }
  }
}

/**
 * O :restaurantId da URL é só o contexto pedido: o acesso vem do vínculo ATIVO do usuário
 * autenticado, consultado no banco a cada requisição. Sem vínculo ativo: 404.
 */
export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const restaurantId = uuidParam(ctx.params.restaurantId)

    const link = await db
      .from('restaurant_users')
      .where({ restaurant_id: restaurantId, user_id: ctx.auth.user!.id, is_active: true })
      .select('role')
      .first()
    if (!link) throw ApiError.notFound()

    ctx.tenant = { restaurantId, role: link.role }
    return next()
  }
}
