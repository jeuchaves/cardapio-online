import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import { audit } from '#support/audit'
import { canTransition } from '#support/order_status'
import { rejectUnknownFields, uuidParam } from '#support/request_helpers'
import { ORDER_STATUS_FIELDS, updateOrderStatusValidator } from '#validators/order_status'

// Alteração de status pelo restaurante (owner e staff). Não existe rota pública equivalente.
export default class OrderStatusController {
  async update({ request, params, tenant, auth }: HttpContext) {
    const orderId = uuidParam(params.id)
    rejectUnknownFields(request.body(), ORDER_STATUS_FIELDS)
    const { status } = await request.validateUsing(updateOrderStatusValidator)
    const actorId = auth.user!.id

    // Leitura com FOR UPDATE, validação, atualização e histórico na mesma transação: duas
    // alterações simultâneas se serializam e a segunda enxerga o estado já alterado.
    const updated = await db.transaction(async (trx) => {
      const order = await trx
        .from('orders')
        .where('restaurant_id', tenant.restaurantId)
        .where('id', orderId)
        .select('id', 'order_number', 'status')
        .forUpdate()
        .first()
      if (!order) throw ApiError.notFound()

      if (!canTransition(order.status, status)) {
        throw new ApiError(409, 'INVALID_TRANSITION', 'Transição de status inválida.')
      }

      const [row] = await trx
        .from('orders')
        .where('restaurant_id', tenant.restaurantId)
        .where('id', order.id)
        .update({ status, updated_at: trx.raw('now()') })
        .returning('updated_at')

      await trx.table('order_status_history').insert({
        restaurant_id: tenant.restaurantId,
        order_id: order.id,
        previous_status: order.status,
        new_status: status,
        changed_by_user_id: actorId,
      })

      return { id: order.id, order_number: order.order_number, status, updated_at: row.updated_at }
    })

    // Só depois do commit; apenas ator, ação e recurso
    audit(actorId, 'order.status_changed', { type: 'order', id: updated.id })
    return { data: updated }
  }
}
