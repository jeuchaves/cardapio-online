import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import { loadOrderLines, sortOrderItems } from '#support/order_response'
import { rejectUnknownFields, uuidParam, validationError } from '#support/request_helpers'
import { LIST_ORDERS_FIELDS, listOrdersValidator } from '#validators/order'

// O dia do filtro é o dia civil do Brasil, qualquer que seja o fuso do servidor
const BUSINESS_ZONE = 'America/Sao_Paulo'

// Intervalo semiaberto: início do dia (inclusive) até o início do dia seguinte (exclusive)
function dayRange(date: string) {
  const start = DateTime.fromISO(date, { zone: BUSINESS_ZONE }).startOf('day')
  if (!start.isValid) throw validationError('date', 'Data inválida.')
  return { start: start.toUTC().toISO()!, end: start.plus({ days: 1 }).toUTC().toISO()! }
}

// Leitura do painel (owner e staff). Toda consulta filtra pelo restaurante do vínculo ativo; o
// token de acompanhamento e as chaves de idempotência nunca saem daqui.
export default class OrdersController {
  async index({ request, tenant }: HttpContext) {
    rejectUnknownFields(request.qs(), LIST_ORDERS_FIELDS)
    const {
      status,
      date,
      page = 1,
      per_page: perPage = 20,
    } = await request.validateUsing(listOrdersValidator)

    const filtered = () => {
      const query = db.from('orders').where('restaurant_id', tenant.restaurantId)
      if (status) query.where('status', status)
      if (date) {
        const { start, end } = dayRange(date)
        query.where('created_at', '>=', start).where('created_at', '<', end)
      }
      return query
    }

    const [{ total }] = await filtered().count('* as total')
    const orders = await filtered()
      .select(
        'id',
        'order_number',
        'status',
        'customer_name',
        'fulfillment_type',
        'total',
        'created_at'
      )
      .orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'order_number', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .offset((page - 1) * perPage)
      .limit(perPage)

    return { data: orders, meta: { page, per_page: perPage, total: Number(total) } }
  }

  async show({ params, tenant }: HttpContext) {
    const order = await db
      .from('orders')
      .where('restaurant_id', tenant.restaurantId)
      .where('id', uuidParam(params.id))
      .select(
        'id',
        'order_number',
        'status',
        'fulfillment_type',
        'payment_method',
        'customer_name',
        'customer_phone',
        'table_name',
        'notes',
        'total',
        'created_at',
        'updated_at'
      )
      .first()
    if (!order) throw ApiError.notFound()

    const items = sortOrderItems(await loadOrderLines(tenant.restaurantId, order.id))
    const history = await db
      .from('order_status_history')
      .where('restaurant_id', tenant.restaurantId)
      .where('order_id', order.id)
      .select('previous_status', 'new_status', 'created_at')
      .orderBy([
        { column: 'created_at', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])

    return {
      data: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        fulfillment_type: order.fulfillment_type,
        payment_method: order.payment_method,
        customer: { name: order.customer_name, phone: order.customer_phone },
        table: order.table_name,
        notes: order.notes,
        total: order.total,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          addons: item.addons.map((addon) => ({ name: addon.name, unit_price: addon.unit_price })),
          subtotal: item.subtotal,
        })),
        history,
      },
    }
  }
}
