import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import { loadOrderLines, sortOrderItems } from '#support/order_response'
import { throttleTracking } from '#support/rate_limit'

// 32 bytes em base64url: sempre 43 caracteres (ROADMAP 5.7)
const TOKEN = /^[A-Za-z0-9_-]{43}$/

// Rota pública (ADR 0002): sem sessão. O token é segredo (ROADMAP 7.3): consulta por igualdade
// exata na coluna única, sem listagem nem busca parcial, e 404 igual para qualquer token que não
// leve a um pedido. O acompanhamento independe de o restaurante estar ativo.
export default class PublicTrackingController {
  async show({ params, request, response }: HttpContext) {
    // Antes de qualquer saída, para valerem também no 404 e no 429
    response.header('Cache-Control', 'no-store')
    response.header('Referrer-Policy', 'no-referrer')

    await throttleTracking(request.ip())

    const token = String(params.trackingToken)
    if (!TOKEN.test(token)) throw ApiError.notFound()

    const order = await db
      .from('orders')
      .join('restaurants', 'restaurants.id', 'orders.restaurant_id')
      .where('orders.tracking_token', token)
      .select(
        'orders.id',
        'orders.restaurant_id',
        'orders.order_number',
        'orders.status',
        'orders.fulfillment_type',
        'orders.total',
        'orders.created_at',
        'orders.updated_at',
        'restaurants.name as restaurant_name'
      )
      .first()
    if (!order) throw ApiError.notFound()

    // Dados mínimos: nada de cliente, telefone, observações, mesa, pagamento, ids ou o token
    const items = sortOrderItems(await loadOrderLines(order.restaurant_id, order.id))
    return {
      data: {
        restaurant_name: order.restaurant_name,
        order_number: order.order_number,
        status: order.status,
        fulfillment_type: order.fulfillment_type,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          addons: item.addons.map((addon) => addon.name),
          subtotal: item.subtotal,
        })),
        total: order.total,
      },
    }
  }
}
