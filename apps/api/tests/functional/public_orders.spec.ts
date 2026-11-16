import { randomBytes, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { createRestaurant, resetState } from '#tests/helpers'

// F5-T2: POST /public/restaurants/:slug/orders. Sem sessão; o backend recalcula todos os valores.

const url = (slug: string) => `/api/v1/public/restaurants/${slug}/orders`

async function insertId(table: string, row: object) {
  const [inserted] = await db.table(table).insert(row).returning('id')
  return inserted.id as string
}

// Restaurante com mesa, produto de 10.00 e dois adicionais (2.00 e 1.50) associados a ele
async function setup(extra: Record<string, unknown> = {}) {
  const restaurant = await createRestaurant()
  if (Object.keys(extra).length > 0) {
    await db.from('restaurants').where('id', restaurant.id).update(extra)
  }
  const id = restaurant.id
  const tableIdentifier = randomBytes(5).toString('hex')
  const tableId = await insertId('restaurant_tables', {
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
  return {
    restaurant,
    id,
    slug: restaurant.slug,
    tableId,
    tableIdentifier,
    categoryId,
    productId,
    addonId,
    addon2Id,
  }
}

type Setup = Awaited<ReturnType<typeof setup>>

function body(s: Setup, extra: Record<string, unknown> = {}) {
  return {
    customer: { name: 'Maria', phone: '11999990000' },
    fulfillment_type: 'dine_in',
    payment_method: 'cash',
    table_identifier: s.tableIdentifier,
    items: [{ product_id: s.productId, quantity: 1, addon_ids: [] }],
    ...extra,
  }
}

function withoutTable(s: Setup) {
  const payload: Record<string, unknown> = body(s)
  delete payload.table_identifier
  return payload
}

const pickup = (s: Setup, extra: Record<string, unknown> = {}) => {
  return { ...withoutTable(s), fulfillment_type: 'pickup', ...extra }
}

async function post(client: any, s: Setup, payload: unknown, key: string | null = randomUUID()) {
  const request = client.post(url(s.slug))
  if (key !== null) request.header('Idempotency-Key', key)
  return request.json(payload)
}

async function counts() {
  const [orders] = (await db.rawQuery('select count(*)::int as n from orders')).rows
  const [items] = (await db.rawQuery('select count(*)::int as n from order_items')).rows
  const [history] = (await db.rawQuery('select count(*)::int as n from order_status_history')).rows
  return { orders: orders.n, items: items.n, history: history.n }
}

const nextNumber = async (id: string) =>
  (await db.from('restaurants').where('id', id).first()).next_order_number as number

test.group('POST /public/restaurants/:slug/orders | criação e totais', (group) => {
  group.each.setup(resetState)

  test('cria o pedido, recalcula o total e grava os snapshots', async ({ client, assert }) => {
    const s = await setup()
    // 3 × (10.00 + 2.00 + 1.50) = 40.50; adicionais por unidade do item: 3 × 2.00 = 6.00
    const response = await post(
      client,
      s,
      body(s, {
        notes: 'Sem cebola',
        items: [{ product_id: s.productId, quantity: 3, addon_ids: [s.addonId, s.addon2Id] }],
      })
    )
    response.assertStatus(201)
    assert.equal(response.header('cache-control'), 'no-store')
    const data = response.body().data
    assert.equal(data.order_number, 1001)
    assert.equal(data.status, 'pending')
    assert.equal(data.total, '40.50')
    assert.match(data.tracking_token, /^[A-Za-z0-9_-]{43}$/)
    assert.deepEqual(data.items, [
      {
        product_id: s.productId,
        name: 'Hambúrguer',
        quantity: 3,
        unit_price: '10.00',
        addons: [
          { id: s.addonId, name: 'Bacon', unit_price: '2.00' },
          { id: s.addon2Id, name: 'Queijo', unit_price: '1.50' },
        ],
        subtotal: '40.50',
      },
    ])

    const order = await db.from('orders').where('restaurant_id', s.id).first()
    assert.equal(order.total, '40.50')
    assert.equal(order.status, 'pending')
    assert.equal(order.table_id, s.tableId)
    assert.equal(order.table_name, 'Mesa 5')
    assert.equal(order.customer_name, 'Maria')
    assert.equal(order.notes, 'Sem cebola')
    assert.equal(order.tracking_token, data.tracking_token)
    assert.match(order.idempotency_hash, /^[0-9a-f]{64}$/)

    const item = await db.from('order_items').where('order_id', order.id).first()
    assert.equal(item.restaurant_id, s.id)
    assert.equal(item.product_name, 'Hambúrguer')
    assert.equal(item.unit_price, '10.00')
    assert.equal(item.quantity, 3)
    assert.equal(item.subtotal, '40.50')

    const addons = await db
      .from('order_item_addons')
      .where('order_item_id', item.id)
      .orderBy('addon_name')
    assert.deepEqual(
      addons.map((a) => [a.addon_name, a.unit_price, a.subtotal, a.restaurant_id]),
      [
        ['Bacon', '2.00', '6.00', s.id],
        ['Queijo', '1.50', '4.50', s.id],
      ]
    )

    const history = await db.from('order_status_history').where('order_id', order.id)
    assert.lengthOf(history, 1)
    assert.isNull(history[0].previous_status)
    assert.equal(history[0].new_status, 'pending')
    assert.isNull(history[0].changed_by_user_id)
  })

  test('soma vários itens sem erro de ponto flutuante e numera em sequência', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const cheap = await insertId('products', {
      restaurant_id: s.id,
      category_id: s.categoryId,
      name: 'Bala',
      price: '0.10',
    })
    const first = await post(
      client,
      s,
      body(s, {
        items: [
          { product_id: cheap, quantity: 3 },
          { product_id: s.productId, quantity: 1, addon_ids: [s.addon2Id] },
        ],
      })
    )
    first.assertStatus(201)
    // 3 × 0.10 + (10.00 + 1.50) = 11.80
    assert.equal(first.body().data.total, '11.80')
    const second = await post(client, s, body(s))
    second.assertStatus(201)
    assert.equal(second.body().data.order_number, 1002)
    assert.equal(await nextNumber(s.id), 1003)
  })

  test('valores monetários enviados pelo cliente são rejeitados', async ({ client, assert }) => {
    const s = await setup()
    const base = body(s)
    const attempts = [
      { ...base, total: '0.01' },
      { ...base, subtotal: '1.00' },
      { ...base, items: [{ product_id: s.productId, quantity: 1, unit_price: '0.01' }] },
      { ...base, items: [{ product_id: s.productId, quantity: 1, price: '0.01' }] },
      { ...base, restaurant_id: randomUUID() },
      { ...base, customer: { name: 'Maria', phone: '1199', total: '1' } },
    ]
    for (const payload of attempts) {
      const response = await post(client, s, payload)
      response.assertStatus(422)
      assert.equal(response.body().code, 'VALIDATION_ERROR')
    }
    assert.deepEqual(await counts(), { orders: 0, items: 0, history: 0 })
    assert.equal(await nextNumber(s.id), 1001)
  })

  test('o preço vem do catálogo no momento do pedido', async ({ client, assert }) => {
    const s = await setup()
    await db.from('products').where('id', s.productId).update({ price: '12.00' })
    const response = await post(client, s, body(s))
    response.assertStatus(201)
    assert.equal(response.body().data.total, '12.00')
  })
})

test.group('POST /public/restaurants/:slug/orders | itens', (group) => {
  group.each.setup(resetState)

  async function assertNothingSaved(assert: any, s: Setup) {
    assert.deepEqual(await counts(), { orders: 0, items: 0, history: 0 })
    assert.equal(await nextNumber(s.id), 1001)
  }

  test('produto indisponível, inexistente ou de outro restaurante: ITEM_UNAVAILABLE', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const other = await setup()
    await db.from('products').where('id', s.productId).update({ is_available: false })
    const missing = randomUUID()

    for (const productId of [s.productId, other.productId, missing]) {
      const response = await post(
        client,
        s,
        body(s, { items: [{ product_id: productId, quantity: 1 }] })
      )
      response.assertStatus(422)
      assert.equal(response.body().code, 'ITEM_UNAVAILABLE')
      assert.deepEqual(response.body().details, { product_ids: [productId], addon_ids: [] })
    }
    await assertNothingSaved(assert, s)
  })

  test('adicional indisponível, não associado ou de outro restaurante: ITEM_UNAVAILABLE', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const other = await setup()
    const loose = await insertId('product_addons', {
      restaurant_id: s.id,
      name: 'Solto',
      price: '1',
    })
    await db.from('product_addons').where('id', s.addon2Id).update({ is_available: false })

    for (const addonId of [loose, other.addonId, s.addon2Id]) {
      const response = await post(
        client,
        s,
        body(s, { items: [{ product_id: s.productId, quantity: 1, addon_ids: [addonId] }] })
      )
      response.assertStatus(422)
      assert.equal(response.body().code, 'ITEM_UNAVAILABLE')
      assert.deepEqual(response.body().details, { product_ids: [], addon_ids: [addonId] })
    }
    await assertNothingSaved(assert, s)
  })

  test('um item ruim cancela o pedido inteiro', async ({ client, assert }) => {
    const s = await setup()
    const response = await post(
      client,
      s,
      body(s, {
        items: [
          { product_id: s.productId, quantity: 1 },
          { product_id: randomUUID(), quantity: 1 },
        ],
      })
    )
    response.assertStatus(422)
    await assertNothingSaved(assert, s)
  })

  test('limites: itens, quantidade, adicionais e textos', async ({ client, assert }) => {
    const s = await setup()
    const lots = Array.from({ length: 31 }, () => ({ product_id: randomUUID(), quantity: 1 }))
    const addons = Array.from({ length: 11 }, () => randomUUID())
    const invalid: Record<string, unknown>[] = [
      { items: [] },
      { items: lots },
      { items: [{ product_id: s.productId, quantity: 0 }] },
      { items: [{ product_id: s.productId, quantity: 21 }] },
      { items: [{ product_id: s.productId, quantity: 1.5 }] },
      { items: [{ product_id: s.productId, quantity: '2' }] },
      { items: [{ product_id: s.productId, quantity: 1, addon_ids: addons }] },
      { items: [{ product_id: s.productId, quantity: 1, addon_ids: [s.addonId, s.addonId] }] },
      {
        items: [
          { product_id: s.productId, quantity: 1 },
          { product_id: s.productId, quantity: 2 },
        ],
      },
      { items: [{ product_id: 'nao-e-uuid', quantity: 1 }] },
      { customer: { name: 'x'.repeat(121), phone: '1' } },
      { customer: { name: '', phone: '1' } },
      { customer: { name: 'Maria', phone: '1'.repeat(21) } },
      { notes: 'x'.repeat(501) },
      { fulfillment_type: 'delivery' },
      { payment_method: 'boleto' },
    ]
    for (const extra of invalid) {
      const response = await post(client, s, body(s, extra))
      response.assertStatus(422)
      assert.equal(response.body().code, 'VALIDATION_ERROR', JSON.stringify(extra).slice(0, 80))
    }
    await assertNothingSaved(assert, s)

    const limits = await post(
      client,
      s,
      body(s, {
        customer: { name: 'x'.repeat(120), phone: '1'.repeat(20) },
        notes: 'x'.repeat(500),
        items: [{ product_id: s.productId, quantity: 20 }],
      })
    )
    limits.assertStatus(201)
    assert.equal(limits.body().data.total, '200.00')
  })
})

test.group('POST /public/restaurants/:slug/orders | modalidade, pagamento e mesa', (group) => {
  group.each.setup(resetState)

  test('modalidade e forma de pagamento desabilitadas são rejeitadas', async ({
    client,
    assert,
  }) => {
    const noPickup = await setup({ accepts_pickup: false })
    ;(await post(client, noPickup, pickup(noPickup))).assertStatus(422)
    ;(await post(client, noPickup, body(noPickup))).assertStatus(201)

    const noDineIn = await setup({ accepts_dine_in: false })
    ;(await post(client, noDineIn, body(noDineIn))).assertStatus(422)
    ;(await post(client, noDineIn, pickup(noDineIn))).assertStatus(201)

    const noPix = await setup({ accepts_pix: false })
    const response = await post(client, noPix, body(noPix, { payment_method: 'pix' }))
    response.assertStatus(422)
    assert.equal(response.body().details[0].field, 'payment_method')
    ;(await post(client, noPix, body(noPix, { payment_method: 'card' }))).assertStatus(201)
  })

  test('telefone: obrigatório em retirada, opcional no local', async ({ client, assert }) => {
    const s = await setup()
    const noPhone = { name: 'Maria' }
    const blank = { name: 'Maria', phone: '  ' }
    for (const customer of [noPhone, blank]) {
      const response = await post(client, s, pickup(s, { customer }))
      response.assertStatus(422)
      assert.equal(response.body().details[0].field, 'customer.phone')
    }
    ;(await post(client, s, pickup(s))).assertStatus(201)
    ;(await post(client, s, body(s, { customer: noPhone }))).assertStatus(201)
    const stored = await db.from('orders').whereNull('customer_phone').first()
    assert.equal(stored.fulfillment_type, 'dine_in')
  })

  test('mesa: pickup não aceita, dine_in exige mesa ativa do mesmo restaurante', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const other = await setup()
    const inactive = randomBytes(5).toString('hex')
    await insertId('restaurant_tables', {
      restaurant_id: s.id,
      name: 'Mesa 9',
      identifier: inactive,
      is_active: false,
    })

    const withTable = await post(client, s, pickup(s, { table_identifier: s.tableIdentifier }))
    withTable.assertStatus(422)
    assert.equal(withTable.body().details[0].field, 'table_identifier')

    ;(await post(client, s, withoutTable(s))).assertStatus(422)
    for (const identifier of [inactive, other.tableIdentifier, 'naoexiste01']) {
      const response = await post(client, s, body(s, { table_identifier: identifier }))
      response.assertStatus(422)
      assert.equal(response.body().details[0].field, 'table_identifier')
    }
    assert.deepEqual(await counts(), { orders: 0, items: 0, history: 0 })
    assert.equal(await nextNumber(s.id), 1001)

    const ok = await post(client, s, pickup(s))
    ok.assertStatus(201)
    const order = await db.from('orders').where('restaurant_id', s.id).first()
    assert.isNull(order.table_id)
    assert.isNull(order.table_name)
  })
})

test.group('POST /public/restaurants/:slug/orders | restaurante, cabeçalho e limite', (group) => {
  group.each.setup(resetState)

  test('restaurante inativo ou inexistente: 404 igual', async ({ client, assert }) => {
    const s = await setup()
    const payload = body(s)
    await db.from('restaurants').where('id', s.id).update({ is_active: false })
    const inactive = await post(client, s, payload)
    inactive.assertStatus(404)
    const unknown = await client
      .post(url('nao-existe'))
      .header('Idempotency-Key', randomUUID())
      .json(payload)
    unknown.assertStatus(404)
    assert.deepEqual(inactive.body(), unknown.body())
    assert.deepEqual(await counts(), { orders: 0, items: 0, history: 0 })
  })

  test('Idempotency-Key é obrigatória e precisa ser UUID', async ({ client, assert }) => {
    const s = await setup()
    for (const key of [null, 'abc', '12345']) {
      const response = await post(client, s, body(s), key)
      response.assertStatus(422)
      assert.equal(response.body().code, 'VALIDATION_ERROR')
    }
    assert.deepEqual(await counts(), { orders: 0, items: 0, history: 0 })
  })

  test('rota pública: o cookie de sessão não é lido nem exigido', async ({ client }) => {
    const s = await setup()
    const response = await client
      .post(url(s.slug))
      .header('Idempotency-Key', randomUUID())
      .header('Cookie', 'cardapio_session=lixo')
      .json(body(s))
    response.assertStatus(201)
  })

  test('rate limit: 5 pedidos por minuto por IP e restaurante', async ({ client }) => {
    const original = env.get('LIMITER_ORDER_PER_MINUTE')
    env.set('LIMITER_ORDER_PER_MINUTE', '5')
    try {
      const s = await setup()
      const other = await setup()
      for (let i = 0; i < 5; i++) (await post(client, s, body(s))).assertStatus(201)
      ;(await post(client, s, body(s))).assertStatus(429)
      // contador próprio de cada restaurante
      ;(await post(client, other, body(other))).assertStatus(201)
    } finally {
      env.set('LIMITER_ORDER_PER_MINUTE', String(original))
    }
  })

  test('falha após o número ser reservado desfaz tudo (rollback)', async ({ client, assert }) => {
    const s = await setup()
    // Produto tornado indisponível durante o pedido: a transação do teste segura a linha, o
    // pedido espera no FOR SHARE e, quando ela confirma, relê o produto já indisponível.
    const blocker = await db.transaction()
    await blocker.from('products').where('id', s.productId).update({ is_available: false })

    let settled = false
    const pending = post(client, s, body(s)).finally(() => {
      settled = true
    })

    // O teste só vale se o pedido estiver mesmo esperando o FOR SHARE de products: sem essa
    // observação ele falha, em vez de passar sem exercitar o cenário.
    let observed = false
    try {
      for (let i = 0; i < 100 && !observed && !settled; i++) {
        const waiting = await db.rawQuery(
          `select count(*)::int as n from pg_stat_activity
            where wait_event_type = 'Lock' and datname = current_database()
              and query ilike '%from "products"%' and query ilike '%for share%'`
        )
        observed = waiting.rows[0].n > 0
        if (!observed) await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } finally {
      await blocker.commit()
    }
    const response = await pending
    assert.isTrue(observed, 'o pedido não ficou bloqueado no FOR SHARE de products')

    response.assertStatus(422)
    assert.equal(response.body().code, 'ITEM_UNAVAILABLE')
    assert.deepEqual(await counts(), { orders: 0, items: 0, history: 0 })
    assert.equal(await nextNumber(s.id), 1001)
  })
})
