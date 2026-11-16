import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { loadCatalog, priceCart, type CartLine } from '#support/order_cart'
import { findActiveRestaurantBySlug } from '#support/public_restaurant'
import { throttleQuote } from '#support/rate_limit'
import { rejectUnknownFields } from '#support/request_helpers'
import { ITEM_FIELDS, QUOTE_FIELDS, createQuoteValidator } from '#validators/order'

// Rota pública (ADR 0002): sem sessão. A cotação é informativa e sem garantia (ROADMAP 5.9):
// não cria pedido, não consome número, não grava, não trava linhas, não reserva produto e não
// emite token. O pedido recalcula tudo na criação.
export default class PublicCartController {
  async quote({ request, response, params }: HttpContext) {
    const restaurant = await findActiveRestaurantBySlug(String(params.slug))
    await throttleQuote(request.ip(), restaurant.id)

    const body = request.body()
    rejectUnknownFields(body, QUOTE_FIELDS)
    if (Array.isArray(body.items)) {
      for (const item of body.items) rejectUnknownFields(item, ITEM_FIELDS)
    }
    const input = await request.validateUsing(createQuoteValidator)

    const lines: CartLine[] = input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      addon_ids: item.addon_ids ?? [],
    }))
    const catalog = await loadCatalog(db.connection(), restaurant.id, lines, false)
    const { items, total } = priceCart(lines, catalog)

    response.header('Cache-Control', 'no-store')
    return { data: { items, total } }
  }
}
