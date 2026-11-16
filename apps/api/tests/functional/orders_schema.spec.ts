import { randomBytes, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { createRestaurant, createUser, resetState } from '#tests/helpers'

// F5-T1: constraints das tabelas de pedidos, verificadas direto no banco (independente da API).

const FK = '23503'
const UNIQUE = '23505'
const CHECK = '23514'
const TOO_LONG = '22001'

async function pgCode(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return (error as { code?: string }).code ?? 'sem-codigo'
  }
  return null
}

async function insertId(table: string, row: object) {
  const [inserted] = await db.table(table).insert(row).returning('id')
  return inserted.id as string
}

const token = () => randomBytes(24).toString('base64url')

// Restaurante com mesa, produto e adicional
async function menu(tag: string) {
  const restaurant = await createRestaurant()
  const tableId = await insertId('restaurant_tables', {
    restaurant_id: restaurant.id,
    name: `Mesa ${tag}`,
    identifier: randomBytes(5).toString('hex'),
  })
  const categoryId = await insertId('categories', {
    restaurant_id: restaurant.id,
    name: `Categoria ${tag}`,
  })
  const productId = await insertId('products', {
    restaurant_id: restaurant.id,
    category_id: categoryId,
    name: `Produto ${tag}`,
    price: '10.00',
  })
  const addonId = await insertId('product_addons', {
    restaurant_id: restaurant.id,
    name: `Adicional ${tag}`,
    price: '2.00',
  })
  return { restaurant, restaurantId: restaurant.id, tableId, productId, addonId }
}

type Menu = Awaited<ReturnType<typeof menu>>

// Pedido válido (dine_in com mesa); `extra` sobrescreve campos
function orderRow(m: Menu, extra: Record<string, unknown> = {}) {
  return {
    restaurant_id: m.restaurantId,
    order_number: 1001,
    table_id: m.tableId,
    table_name: 'Mesa 5',
    customer_name: 'Cliente',
    fulfillment_type: 'dine_in',
    payment_method: 'cash',
    total: '10.00',
    tracking_token: token(),
    idempotency_key: randomUUID(),
    idempotency_hash: 'a'.repeat(64),
    ...extra,
  }
}

const pickupRow = (m: Menu, extra: Record<string, unknown> = {}) =>
  orderRow(m, {
    fulfillment_type: 'pickup',
    table_id: null,
    table_name: null,
    customer_phone: '11999990000',
    ...extra,
  })

function itemRow(m: Menu, orderId: string, extra: Record<string, unknown> = {}) {
  return {
    restaurant_id: m.restaurantId,
    order_id: orderId,
    product_id: m.productId,
    product_name: 'Produto',
    unit_price: '10.00',
    quantity: 1,
    subtotal: '10.00',
    ...extra,
  }
}

function addonRow(m: Menu, itemId: string, extra: Record<string, unknown> = {}) {
  return {
    restaurant_id: m.restaurantId,
    order_item_id: itemId,
    product_addon_id: m.addonId,
    addon_name: 'Adicional',
    unit_price: '2.00',
    subtotal: '2.00',
    ...extra,
  }
}

// Pedido com item, adicional e histórico, tudo do mesmo restaurante
async function fullOrder(m: Menu, extra: Record<string, unknown> = {}) {
  const orderId = await insertId('orders', orderRow(m, extra))
  const itemId = await insertId('order_items', itemRow(m, orderId))
  const addonId = await insertId('order_item_addons', addonRow(m, itemId))
  const historyId = await insertId('order_status_history', {
    restaurant_id: m.restaurantId,
    order_id: orderId,
    previous_status: null,
    new_status: 'pending',
  })
  return { orderId, itemId, addonId, historyId }
}

test.group('Schema de pedidos | integridade por restaurante (FK-04 a FK-09)', (group) => {
  group.each.setup(resetState)

  test('FK-04: pedido não aceita mesa de outro restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    assert.equal(await pgCode(() => insertId('orders', orderRow(a, { table_id: b.tableId }))), FK)
    assert.isNull(await pgCode(() => insertId('orders', orderRow(a))))
    assert.equal(
      await pgCode(() =>
        db.from('orders').where('restaurant_id', a.restaurantId).update({ table_id: b.tableId })
      ),
      FK
    )
  })

  test('FK-05: item não aceita pedido de outro restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    const orderA = await insertId('orders', orderRow(a))
    assert.equal(
      await pgCode(() => insertId('order_items', itemRow(b, orderA, { product_id: null }))),
      FK
    )
    assert.isNull(await pgCode(() => insertId('order_items', itemRow(a, orderA))))
  })

  test('FK-06: item não referencia produto de outro restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    const orderA = await insertId('orders', orderRow(a))
    assert.equal(
      await pgCode(() => insertId('order_items', itemRow(a, orderA, { product_id: b.productId }))),
      FK
    )
  })

  test('FK-07: adicional do item não aceita item de outro restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    const orderA = await insertId('orders', orderRow(a))
    const itemA = await insertId('order_items', itemRow(a, orderA))
    assert.equal(
      await pgCode(() =>
        insertId('order_item_addons', addonRow(b, itemA, { product_addon_id: null }))
      ),
      FK
    )
    assert.isNull(await pgCode(() => insertId('order_item_addons', addonRow(a, itemA))))
  })

  test('FK-08: adicional do item não referencia adicional de outro restaurante', async ({
    assert,
  }) => {
    const a = await menu('A')
    const b = await menu('B')
    const orderA = await insertId('orders', orderRow(a))
    const itemA = await insertId('order_items', itemRow(a, orderA))
    assert.equal(
      await pgCode(() =>
        insertId('order_item_addons', addonRow(a, itemA, { product_addon_id: b.addonId }))
      ),
      FK
    )
  })

  test('FK-09: histórico não aceita pedido de outro restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    const orderA = await insertId('orders', orderRow(a))
    const history = (restaurantId: string) => ({
      restaurant_id: restaurantId,
      order_id: orderA,
      new_status: 'pending',
    })
    assert.equal(await pgCode(() => insertId('order_status_history', history(b.restaurantId))), FK)
    assert.isNull(await pgCode(() => insertId('order_status_history', history(a.restaurantId))))
  })
})

test.group('Schema de pedidos | restrições (CT-01 a CT-04 e CT-06)', (group) => {
  group.each.setup(resetState)

  test('CT-01: número do pedido é único por restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    await insertId('orders', orderRow(a, { order_number: 1001 }))
    assert.equal(
      await pgCode(() => insertId('orders', orderRow(a, { order_number: 1001 }))),
      UNIQUE
    )
    assert.isNull(await pgCode(() => insertId('orders', orderRow(a, { order_number: 1002 }))))
    assert.isNull(await pgCode(() => insertId('orders', orderRow(b, { order_number: 1001 }))))
  })

  test('CT-02: chave de idempotência é única por restaurante', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    const key = randomUUID()
    await insertId('orders', orderRow(a, { order_number: 1001, idempotency_key: key }))
    assert.equal(
      await pgCode(() =>
        insertId('orders', orderRow(a, { order_number: 1002, idempotency_key: key }))
      ),
      UNIQUE
    )
    assert.isNull(
      await pgCode(() =>
        insertId('orders', orderRow(b, { order_number: 1001, idempotency_key: key }))
      )
    )
  })

  test('CT-03: pickup exige telefone; dine_in aceita sem telefone', async ({ assert }) => {
    const a = await menu('A')
    assert.equal(
      await pgCode(() => insertId('orders', pickupRow(a, { customer_phone: null }))),
      CHECK
    )
    assert.isNull(await pgCode(() => insertId('orders', pickupRow(a))))
    assert.isNull(
      await pgCode(() =>
        insertId('orders', orderRow(a, { order_number: 1002, customer_phone: null }))
      )
    )
  })

  test('CT-04: pickup não tem mesa; dine_in exige o nome da mesa', async ({ assert }) => {
    const a = await menu('A')
    assert.equal(
      await pgCode(() => insertId('orders', pickupRow(a, { table_id: a.tableId }))),
      CHECK
    )
    assert.equal(
      await pgCode(() => insertId('orders', pickupRow(a, { table_name: 'Mesa 5' }))),
      CHECK
    )
    assert.equal(await pgCode(() => insertId('orders', orderRow(a, { table_name: null }))), CHECK)
    // dine_in sem table_id é válido (a mesa pode ter sido excluída, ver SET NULL)
    assert.isNull(await pgCode(() => insertId('orders', orderRow(a, { table_id: null }))))
  })

  test('CT-06: quantidade fora de 1 a 20 e valores negativos são rejeitados', async ({
    assert,
  }) => {
    const a = await menu('A')
    const orderId = await insertId('orders', orderRow(a))
    const item = (extra: Record<string, unknown>) =>
      insertId('order_items', itemRow(a, orderId, extra))

    for (const quantity of [0, 21, -1]) {
      assert.equal(await pgCode(() => item({ quantity })), CHECK, `quantity ${quantity}`)
    }
    for (const quantity of [1, 20]) assert.isNull(await pgCode(() => item({ quantity })))
    assert.equal(await pgCode(() => item({ unit_price: '-0.01' })), CHECK)
    assert.equal(await pgCode(() => item({ subtotal: '-1.00' })), CHECK)

    const itemId = await item({})
    assert.equal(
      await pgCode(() =>
        insertId(
          'order_item_addons',
          addonRow(a, itemId, { product_addon_id: null, unit_price: '-1' })
        )
      ),
      CHECK
    )
    assert.equal(
      await pgCode(() =>
        insertId(
          'order_item_addons',
          addonRow(a, itemId, { product_addon_id: null, subtotal: '-1' })
        )
      ),
      CHECK
    )
    assert.equal(
      await pgCode(() => insertId('orders', orderRow(a, { order_number: 1002, total: '-0.01' }))),
      CHECK
    )
    assert.isNull(
      await pgCode(() => insertId('orders', orderRow(a, { order_number: 1003, total: '0.00' })))
    )
  })

  test('domínios fechados de status, modalidade e forma de pagamento', async ({ assert }) => {
    const a = await menu('A')
    let number = 2000
    const order = (extra: Record<string, unknown>) =>
      insertId('orders', orderRow(a, { order_number: number++, ...extra }))

    for (const status of ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']) {
      assert.isNull(await pgCode(() => order({ status })), status)
    }
    assert.equal(await pgCode(() => order({ status: 'delivered' })), CHECK)
    assert.equal(await pgCode(() => order({ fulfillment_type: 'delivery' })), CHECK)
    assert.equal(await pgCode(() => order({ payment_method: 'boleto' })), CHECK)

    const orderId = await order({})
    const history = (extra: Record<string, unknown>) =>
      insertId('order_status_history', {
        restaurant_id: a.restaurantId,
        order_id: orderId,
        new_status: 'confirmed',
        ...extra,
      })
    assert.isNull(await pgCode(() => history({ previous_status: 'pending' })))
    assert.isNull(await pgCode(() => history({ previous_status: null })))
    assert.equal(await pgCode(() => history({ new_status: 'delivered' })), CHECK)
    assert.equal(await pgCode(() => history({ previous_status: 'delivered' })), CHECK)
  })

  test('tracking_token é único e campos obrigatórios não aceitam nulo', async ({ assert }) => {
    const a = await menu('A')
    const b = await menu('B')
    const shared = token()
    await insertId('orders', orderRow(a, { tracking_token: shared }))
    // único em toda a tabela, não só por restaurante
    assert.equal(
      await pgCode(() => insertId('orders', orderRow(b, { tracking_token: shared }))),
      UNIQUE
    )
    for (const field of [
      'order_number',
      'customer_name',
      'fulfillment_type',
      'payment_method',
      'total',
      'tracking_token',
      'idempotency_key',
      'idempotency_hash',
    ]) {
      assert.equal(
        await pgCode(() => insertId('orders', orderRow(a, { order_number: 3000, [field]: null }))),
        '23502',
        field
      )
    }
  })

  test('valores padrão e limites de tamanho', async ({ assert }) => {
    const a = await menu('A')
    const id = await insertId('orders', orderRow(a))
    const row = await db.from('orders').where('id', id).first()
    assert.equal(row.status, 'pending')
    assert.equal(row.total, '10.00')
    assert.instanceOf(row.created_at, Date)
    assert.instanceOf(row.updated_at, Date)
    assert.isNull(row.notes)

    let number = 4000
    const order = (extra: Record<string, unknown>) =>
      insertId('orders', orderRow(a, { order_number: number++, ...extra }))
    assert.equal(await pgCode(() => order({ customer_name: 'x'.repeat(121) })), TOO_LONG)
    assert.isNull(await pgCode(() => order({ customer_name: 'x'.repeat(120) })))
    assert.equal(await pgCode(() => order({ notes: 'x'.repeat(501) })), TOO_LONG)
    assert.isNull(await pgCode(() => order({ notes: 'x'.repeat(500) })))
    assert.equal(await pgCode(() => order({ customer_phone: '1'.repeat(21) })), TOO_LONG)
    assert.equal(await pgCode(() => order({ table_name: 'x'.repeat(61) })), TOO_LONG)

    const orderId = await insertId('orders', orderRow(a, { order_number: 5000 }))
    assert.equal(
      await pgCode(() =>
        insertId('order_items', itemRow(a, orderId, { product_name: 'x'.repeat(121) }))
      ),
      TOO_LONG
    )
    const itemId = await insertId('order_items', itemRow(a, orderId))
    assert.equal(
      await pgCode(() =>
        insertId('order_item_addons', addonRow(a, itemId, { addon_name: 'x'.repeat(81) }))
      ),
      TOO_LONG
    )
  })

  test('um adicional por item: o mesmo adicional não repete no mesmo item', async ({ assert }) => {
    const a = await menu('A')
    const orderId = await insertId('orders', orderRow(a))
    const itemId = await insertId('order_items', itemRow(a, orderId))
    const otherItem = await insertId('order_items', itemRow(a, orderId))
    await insertId('order_item_addons', addonRow(a, itemId))
    assert.equal(await pgCode(() => insertId('order_item_addons', addonRow(a, itemId))), UNIQUE)
    assert.isNull(await pgCode(() => insertId('order_item_addons', addonRow(a, otherItem))))
  })

  test('UNIQUE (id, restaurant_id) existe nas tabelas que são alvo de FK composta', async ({
    assert,
  }) => {
    const result = await db.rawQuery(
      `SELECT c.conrelid::regclass::text AS tabela,
              array_agg(a.attname::text ORDER BY a.attname)::text[] AS colunas
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'u' AND c.conrelid::regclass::text IN ('orders', 'order_items')
        GROUP BY c.oid, c.conrelid`
    )
    const sets = result.rows.map(
      (r: { tabela: string; colunas: string[] }) => `${r.tabela}:${r.colunas.join()}`
    )
    assert.include(sets, 'orders:id,restaurant_id')
    assert.include(sets, 'order_items:id,restaurant_id')
  })
})

test.group('Schema de pedidos | SET NULL preserva restaurant_id e snapshots', (group) => {
  group.each.setup(resetState)

  test('excluir o produto anula só product_id; o snapshot e o restaurante ficam', async ({
    assert,
  }) => {
    const a = await menu('A')
    const b = await menu('B')
    const { itemId } = await fullOrder(a)
    const other = await fullOrder(b, { order_number: 1001 })

    await db.from('product_product_addons').where('product_id', a.productId).delete()
    await db.from('products').where('id', a.productId).delete()

    const item = await db.from('order_items').where('id', itemId).first()
    assert.isNull(item.product_id)
    assert.equal(item.restaurant_id, a.restaurantId)
    assert.equal(item.product_name, 'Produto')
    assert.equal(item.unit_price, '10.00')
    assert.equal(item.subtotal, '10.00')
    // item de outro restaurante não é afetado
    const untouched = await db.from('order_items').where('id', other.itemId).first()
    assert.equal(untouched.product_id, b.productId)
  })

  test('excluir o adicional anula só product_addon_id; dois adicionais anulados convivem', async ({
    assert,
  }) => {
    const a = await menu('A')
    const second = await insertId('product_addons', {
      restaurant_id: a.restaurantId,
      name: 'Segundo',
      price: '1.00',
    })
    const { itemId, addonId } = await fullOrder(a)
    const secondRow = await insertId(
      'order_item_addons',
      addonRow(a, itemId, {
        product_addon_id: second,
        addon_name: 'Segundo',
        unit_price: '1.00',
        subtotal: '1.00',
      })
    )

    await db
      .from('product_product_addons')
      .whereIn('product_addon_id', [a.addonId, second])
      .delete()
    await db.from('product_addons').whereIn('id', [a.addonId, second]).delete()

    const rows = await db
      .from('order_item_addons')
      .whereIn('id', [addonId, secondRow])
      .orderBy('addon_name')
    assert.lengthOf(rows, 2)
    for (const row of rows) {
      assert.isNull(row.product_addon_id)
      assert.equal(row.restaurant_id, a.restaurantId)
    }
    assert.deepEqual(
      rows.map((r) => r.addon_name),
      ['Adicional', 'Segundo']
    )
    assert.deepEqual(
      rows.map((r) => r.unit_price),
      ['2.00', '1.00']
    )
  })

  test('excluir a mesa anula só table_id; table_name, restaurante e demais pedidos ficam', async ({
    assert,
  }) => {
    const a = await menu('A')
    const otherTable = await insertId('restaurant_tables', {
      restaurant_id: a.restaurantId,
      name: 'Mesa 9',
      identifier: randomBytes(5).toString('hex'),
    })
    const { orderId } = await fullOrder(a)
    const keptId = await insertId(
      'orders',
      orderRow(a, { order_number: 1002, table_id: otherTable, table_name: 'Mesa 9' })
    )
    const pickupId = await insertId('orders', pickupRow(a, { order_number: 1003 }))

    await db.from('restaurant_tables').where('id', a.tableId).delete()

    const order = await db.from('orders').where('id', orderId).first()
    assert.isNull(order.table_id)
    assert.equal(order.restaurant_id, a.restaurantId)
    assert.equal(order.table_name, 'Mesa 5')
    assert.equal(order.fulfillment_type, 'dine_in')
    assert.equal((await db.from('orders').where('id', keptId).first()).table_id, otherTable)
    assert.isNull((await db.from('orders').where('id', pickupId).first()).table_id)
  })
})

test.group('Schema de pedidos | RESTRICT e histórico', (group) => {
  group.each.setup(resetState)

  test('pedido com itens ou histórico, item com adicionais e restaurante com pedidos não são excluídos', async ({
    assert,
  }) => {
    const a = await menu('A')
    const { orderId, itemId } = await fullOrder(a)

    assert.equal(await pgCode(() => db.from('order_items').where('id', itemId).delete()), FK)
    assert.equal(await pgCode(() => db.from('orders').where('id', orderId).delete()), FK)
    assert.equal(
      await pgCode(() => db.from('restaurants').where('id', a.restaurantId).delete()),
      FK
    )
    assert.lengthOf(await db.from('orders').where('id', orderId), 1)
  })

  test('excluir o usuário anula changed_by_user_id e mantém o histórico', async ({ assert }) => {
    const a = await menu('A')
    const user = await createUser()
    const { orderId } = await fullOrder(a)
    const historyId = await insertId('order_status_history', {
      restaurant_id: a.restaurantId,
      order_id: orderId,
      previous_status: 'pending',
      new_status: 'confirmed',
      changed_by_user_id: user.id,
    })

    await db.from('users').where('id', user.id).delete()

    const row = await db.from('order_status_history').where('id', historyId).first()
    assert.isNull(row.changed_by_user_id)
    assert.equal(row.restaurant_id, a.restaurantId)
    assert.equal(row.new_status, 'confirmed')
  })

  test('o registro de criação do histórico tem previous_status nulo', async ({ assert }) => {
    const a = await menu('A')
    const { historyId } = await fullOrder(a)
    const row = await db.from('order_status_history').where('id', historyId).first()
    assert.isNull(row.previous_status)
    assert.isNull(row.changed_by_user_id)
    assert.instanceOf(row.created_at, Date)
  })
})
