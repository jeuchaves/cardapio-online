import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { createRestaurant } from '#tests/helpers'

// Cenário compartilhado pelos testes de idempotência: restaurante com mesa, produto de 10.00 e
// dois adicionais (Bacon 2.00 e Queijo 1.50) associados a ele.

export async function insertId(table: string, row: object) {
  const [inserted] = await db.table(table).insert(row).returning('id')
  return inserted.id as string
}

export async function setup() {
  const restaurant = await createRestaurant()
  const id = restaurant.id
  const tableIdentifier = 'mesa123456'
  await insertId('restaurant_tables', {
    restaurant_id: id,
    name: 'Mesa 5',
    identifier: tableIdentifier,
  })
  const categoryId = await insertId('categories', { restaurant_id: id, name: 'Lanches' })
  const productId = await insertId('products', {
    restaurant_id: id,
    category_id: categoryId,
    name: 'Hambúrguer',
    price: '10.00',
  })
  const addonId = await insertId('product_addons', {
    restaurant_id: id,
    name: 'Bacon',
    price: '2.00',
  })
  const addon2Id = await insertId('product_addons', {
    restaurant_id: id,
    name: 'Queijo',
    price: '1.50',
  })
  for (const addon of [addonId, addon2Id]) {
    await db
      .table('product_product_addons')
      .insert({ restaurant_id: id, product_id: productId, product_addon_id: addon })
  }
  return { id, slug: restaurant.slug, tableIdentifier, categoryId, productId, addonId, addon2Id }
}

export type Setup = Awaited<ReturnType<typeof setup>>

export function orderBody(s: Setup, extra: Record<string, unknown> = {}) {
  return {
    customer: { name: 'Maria', phone: '11999990000' },
    fulfillment_type: 'dine_in',
    payment_method: 'cash',
    table_identifier: s.tableIdentifier,
    items: [{ product_id: s.productId, quantity: 2, addon_ids: [s.addonId] }],
    ...extra,
  }
}

export const orderUrl = (slug: string) => `/api/v1/public/restaurants/${slug}/orders`

export type Client = any

export function postOrder(client: Client, s: Setup, key: string | null, payload: unknown) {
  const request = client.post(orderUrl(s.slug))
  if (key !== null) request.header('Idempotency-Key', key)
  return request.json(payload)
}

export async function counts() {
  const result = await db.rawQuery(
    `select (select count(*)::int from orders) as orders,
            (select count(*)::int from order_items) as items,
            (select count(*)::int from order_item_addons) as addons,
            (select count(*)::int from order_status_history) as history`
  )
  return result.rows[0] as Record<string, number>
}

export const nextNumber = async (id: string) =>
  (await db.from('restaurants').where('id', id).first()).next_order_number as number

export const newKey = () => randomUUID()
