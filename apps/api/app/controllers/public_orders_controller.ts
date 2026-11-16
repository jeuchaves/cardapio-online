import { randomBytes, randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ApiError from '#exceptions/api_error'
import { hashOrderInput } from '#support/order_hash'
import { addonSubtotal, loadCatalog, priceCart, type CartLine } from '#support/order_cart'
import { findActiveRestaurantBySlug, type PublicRestaurant } from '#support/public_restaurant'
import { throttleOrderCreation } from '#support/rate_limit'
import { loadOrderBody, sortOrderItems, type OrderBody } from '#support/order_response'
import {
  isUniqueViolation,
  isUuid,
  rejectUnknownFields,
  validationError,
} from '#support/request_helpers'
import { CUSTOMER_FIELDS, ITEM_FIELDS, ORDER_FIELDS, createOrderValidator } from '#validators/order'

const IDEMPOTENCY_UNIQUE = 'orders_restaurant_idempotency_key_unique'

type OrderInput = Awaited<ReturnType<typeof createOrderValidator.validate>>

// Rota pública (ADR 0002): sem sessão. O tenant vem do slug; o cliente nunca informa o restaurante.
// Valores monetários do cliente não existem no contrato: o backend recalcula tudo (ROADMAP 5.5).
export default class PublicOrdersController {
  async store({ request, response, params }: HttpContext) {
    const restaurant = await findActiveRestaurantBySlug(String(params.slug))
    await throttleOrderCreation(request.ip(), restaurant.id)

    const idempotencyKey = request.header('idempotency-key')
    if (!isUuid(idempotencyKey)) {
      throw validationError('Idempotency-Key', 'Informe o header Idempotency-Key com um UUID.')
    }

    rejectUnknownNestedFields(request.body())
    const input = await request.validateUsing(createOrderValidator)
    checkModalityAndPayment(restaurant, input)

    const lines: CartLine[] = input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      addon_ids: item.addon_ids ?? [],
    }))
    const idempotencyHash = hashOrderInput(input)

    // A resposta leva o token, então não pode ser guardada em cache
    response.header('Cache-Control', 'no-store')

    // Passo 3: chave já usada neste restaurante. Mesmo conteúdo devolve o pedido; outro, 409
    const existing = await replayOrConflict(restaurant.id, idempotencyKey, idempotencyHash)
    if (existing) return response.status(200).send({ data: existing })

    let order: OrderBody
    try {
      // Uma transação: qualquer erro antes do commit desfaz tudo, inclusive o número do pedido
      order = await db.transaction((trx) =>
        createOrder(trx, restaurant.id, input, lines, idempotencyKey, idempotencyHash)
      )
    } catch (error) {
      // Passo 11: só a violação da chave de idempotência é uma corrida recuperável. A transação
      // já foi desfeita aqui; relê o pedido vencedor. Sem vencedor, o erro original segue.
      if (!isUniqueViolation(error, IDEMPOTENCY_UNIQUE)) throw error
      const winner = await replayOrConflict(restaurant.id, idempotencyKey, idempotencyHash)
      if (!winner) throw error
      return response.status(200).send({ data: winner })
    }

    // A resposta só existe depois do commit
    return response.status(201).send({ data: order })
  }
}

/**
 * Pedido já criado com esta chave, no mesmo restaurante: devolve o corpo se o conteúdo é o mesmo
 * (hash igual) ou responde 409 se é diferente. O 409 não expõe dados do pedido existente.
 */
async function replayOrConflict(restaurantId: string, key: string, hash: string) {
  const existing = await db
    .from('orders')
    .where('restaurant_id', restaurantId)
    .where('idempotency_key', key)
    .first()
  if (!existing) return null
  if (existing.idempotency_hash !== hash) {
    throw new ApiError(409, 'CONFLICT', 'Esta chave de idempotência já foi usada com outro pedido.')
  }
  return loadOrderBody(restaurantId, existing)
}

// O Vine descarta campos extras; o contrato rejeita (inclusive qualquer campo monetário)
function rejectUnknownNestedFields(body: unknown) {
  rejectUnknownFields(body, ORDER_FIELDS)
  const record = (body ?? {}) as Record<string, unknown>
  if (record.customer && typeof record.customer === 'object') {
    rejectUnknownFields(record.customer, CUSTOMER_FIELDS)
  }
  if (Array.isArray(record.items)) {
    for (const item of record.items) rejectUnknownFields(item, ITEM_FIELDS)
  }
}

function checkModalityAndPayment(restaurant: PublicRestaurant, input: OrderInput) {
  const modeEnabled =
    input.fulfillment_type === 'dine_in' ? restaurant.accepts_dine_in : restaurant.accepts_pickup
  if (!modeEnabled) {
    throw validationError('fulfillment_type', 'Modalidade não disponível neste restaurante.')
  }
  const paymentEnabled = {
    cash: restaurant.accepts_cash,
    card: restaurant.accepts_card,
    pix: restaurant.accepts_pix,
  }[input.payment_method]
  if (!paymentEnabled) {
    throw validationError('payment_method', 'Forma de pagamento não disponível neste restaurante.')
  }

  if (input.fulfillment_type === 'pickup') {
    if (input.table_identifier !== undefined) {
      throw validationError('table_identifier', 'Retirada não usa mesa.')
    }
    if (!input.customer.phone) {
      throw validationError('customer.phone', 'Informe o telefone para retirada.')
    }
  } else if (input.table_identifier === undefined) {
    throw validationError('table_identifier', 'Informe a mesa.')
  }
}

async function createOrder(
  trx: TransactionClientContract,
  restaurantId: string,
  input: OrderInput,
  lines: CartLine[],
  idempotencyKey: string,
  idempotencyHash: string
): Promise<OrderBody> {
  // Número atômico por restaurante; o rollback desfaz o incremento se algo falhar depois
  const numbered = await trx.rawQuery(
    `UPDATE restaurants SET next_order_number = next_order_number + 1
      WHERE id = ? AND is_active = true
  RETURNING next_order_number - 1 AS order_number`,
    [restaurantId]
  )
  const orderNumber = numbered.rows[0]?.order_number as number | undefined
  if (orderNumber === undefined) throw ApiError.notFound()

  // Leituras com filtro de restaurante e FOR SHARE: preço e disponibilidade não mudam até o commit
  let table: { id: string; name: string } | null = null
  if (input.fulfillment_type === 'dine_in') {
    table = await trx
      .from('restaurant_tables')
      .where('restaurant_id', restaurantId)
      .where('identifier', input.table_identifier!)
      .where('is_active', true)
      .forShare()
      .select('id', 'name')
      .first()
    if (!table) throw validationError('table_identifier', 'Mesa inválida.')
  }

  const catalog = await loadCatalog(trx, restaurantId, lines, true)
  const priced = priceCart(lines, catalog)

  const orderId = randomUUID()
  const trackingToken = randomBytes(32).toString('base64url')
  await trx.table('orders').insert({
    id: orderId,
    restaurant_id: restaurantId,
    order_number: orderNumber,
    table_id: table?.id ?? null,
    table_name: table?.name ?? null,
    customer_name: input.customer.name,
    customer_phone: input.customer.phone ?? null,
    fulfillment_type: input.fulfillment_type,
    payment_method: input.payment_method,
    status: 'pending',
    total: priced.total,
    notes: input.notes ?? null,
    tracking_token: trackingToken,
    idempotency_key: idempotencyKey,
    idempotency_hash: idempotencyHash,
  })

  // Ids gerados aqui também desempatam a ordem canônica da resposta (order_response.ts)
  const itemRows = priced.items.map((item) => ({
    id: randomUUID(),
    item,
    addons: item.addons.map((addon) => ({ ...addon, row_id: randomUUID() })),
  }))
  await trx.table('order_items').insert(
    itemRows.map(({ id, item }) => ({
      id,
      restaurant_id: restaurantId,
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    }))
  )

  const addonRows = itemRows.flatMap(({ id, item, addons }) =>
    addons.map((addon) => ({
      id: addon.row_id,
      restaurant_id: restaurantId,
      order_item_id: id,
      product_addon_id: addon.id,
      addon_name: addon.name,
      unit_price: addon.unit_price,
      // preço do adicional por unidade do item × quantidade do item (calculado em big.js)
      subtotal: addonSubtotal(addon.unit_price, item.quantity),
    }))
  )
  if (addonRows.length > 0) await trx.table('order_item_addons').insert(addonRows)

  await trx.table('order_status_history').insert({
    restaurant_id: restaurantId,
    order_id: orderId,
    previous_status: null,
    new_status: 'pending',
    changed_by_user_id: null,
  })

  return {
    order_number: orderNumber,
    tracking_token: trackingToken,
    status: 'pending',
    total: priced.total,
    items: sortOrderItems(
      itemRows.map(({ id, item, addons }) => ({ ...item, row_id: id, addons }))
    ),
  }
}
