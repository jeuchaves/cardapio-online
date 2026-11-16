import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { createRestaurant, resetState } from '#tests/helpers'

// F5-T2a: POST /public/restaurants/:slug/cart/quote. Informativa: não deixa rastro no banco.

const quoteUrl = (slug: string) => `/api/v1/public/restaurants/${slug}/cart/quote`
const orderUrl = (slug: string) => `/api/v1/public/restaurants/${slug}/orders`
const menuUrl = (slug: string) => `/api/v1/public/restaurants/${slug}`

async function insertId(table: string, row: object) {
  const [inserted] = await db.table(table).insert(row).returning('id')
  return inserted.id as string
}

// Restaurante com mesa, produto de 10.00 e dois adicionais (2.00 e 1.50) associados a ele
async function setup() {
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

type Setup = Awaited<ReturnType<typeof setup>>

type Client = any

const quote = (client: Client, s: Setup, payload: unknown) =>
  client.post(quoteUrl(s.slug)).json(payload)

function orderBody(s: Setup, items: unknown[]) {
  return {
    customer: { name: 'Maria', phone: '11999990000' },
    fulfillment_type: 'dine_in',
    payment_method: 'cash',
    table_identifier: s.tableIdentifier,
    items,
  }
}

const createOrder = (client: Client, s: Setup, items: unknown[]) =>
  client.post(orderUrl(s.slug)).header('Idempotency-Key', randomUUID()).json(orderBody(s, items))

async function tableCounts() {
  const result = await db.rawQuery(
    `select (select count(*)::int from orders) as orders,
            (select count(*)::int from order_items) as items,
            (select count(*)::int from order_item_addons) as addons,
            (select count(*)::int from order_status_history) as history`
  )
  return result.rows[0] as Record<string, number>
}

const nextNumber = async (id: string) =>
  (await db.from('restaurants').where('id', id).first()).next_order_number as number

const ZERO = { orders: 0, items: 0, addons: 0, history: 0 }

test.group('POST /public/restaurants/:slug/cart/quote | totais', (group) => {
  group.each.setup(resetState)

  test('cota com adicional por unidade e devolve strings com duas casas', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const response = await quote(client, s, {
      items: [{ product_id: s.productId, quantity: 3, addon_ids: [s.addonId, s.addon2Id] }],
    })
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'no-store')
    // 3 × (10.00 + 2.00 + 1.50) = 40.50
    assert.deepEqual(response.body(), {
      data: {
        items: [
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
        ],
        total: '40.50',
      },
    })
    assert.isUndefined(response.body().data.tracking_token)
  })

  test('soma centavos sem erro de ponto flutuante', async ({ client, assert }) => {
    const s = await setup()
    const cheap = await insertId('products', {
      restaurant_id: s.id,
      category_id: s.categoryId,
      name: 'Bala',
      price: '0.10',
    })
    const response = await quote(client, s, {
      items: [
        { product_id: cheap, quantity: 3 },
        { product_id: s.productId, quantity: 1, addon_ids: [s.addon2Id] },
      ],
    })
    response.assertStatus(200)
    assert.equal(response.body().data.total, '11.80')
    assert.equal(response.body().data.items[0].subtotal, '0.30')
  })

  test('o total e os itens são idênticos aos do pedido para o mesmo carrinho', async ({
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
    const items = [
      { product_id: cheap, quantity: 7 },
      { product_id: s.productId, quantity: 3, addon_ids: [s.addonId, s.addon2Id] },
    ]
    const quoted = await quote(client, s, { items })
    const created = await createOrder(client, s, items)
    quoted.assertStatus(200)
    created.assertStatus(201)
    assert.equal(quoted.body().data.total, created.body().data.total)
    assert.deepEqual(quoted.body().data.items, created.body().data.items)
  })

  test('cotar, mudar o preço no catálogo e pedir: o pedido usa o preço novo', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const items = [{ product_id: s.productId, quantity: 2 }]
    const quoted = await quote(client, s, { items })
    assert.equal(quoted.body().data.total, '20.00')

    await db.from('products').where('id', s.productId).update({ price: '12.50' })
    const created = await createOrder(client, s, items)
    created.assertStatus(201)
    assert.equal(created.body().data.total, '25.00')
  })

  test('o Idempotency-Key é ignorado e a sessão não é usada', async ({ client }) => {
    const s = await setup()
    const response = await client
      .post(quoteUrl(s.slug))
      .header('Idempotency-Key', 'qualquer-coisa')
      .header('Cookie', 'cardapio_session=lixo')
      .json({ items: [{ product_id: s.productId, quantity: 1 }] })
    response.assertStatus(200)
  })
})

test.group('POST /public/restaurants/:slug/cart/quote | entrada e itens', (group) => {
  group.each.setup(resetState)

  test('campos monetários ou desconhecidos são rejeitados', async ({ client, assert }) => {
    const s = await setup()
    const item = { product_id: s.productId, quantity: 1 }
    const attempts = [
      { items: [item], total: '0.01' },
      { items: [item], restaurant_id: randomUUID() },
      { items: [{ ...item, unit_price: '0.01' }] },
      { items: [{ ...item, price: '0.01' }] },
      { items: [{ ...item, subtotal: '0.01' }] },
    ]
    for (const payload of attempts) {
      const response = await quote(client, s, payload)
      response.assertStatus(422)
      assert.equal(response.body().code, 'VALIDATION_ERROR')
    }
  })

  test('limites: itens, quantidade, adicionais, duplicados e formato', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const lots = Array.from({ length: 31 }, () => ({ product_id: randomUUID(), quantity: 1 }))
    const addons = Array.from({ length: 11 }, () => randomUUID())
    const invalid: unknown[] = [
      {},
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
    ]
    for (const payload of invalid) {
      const response = await quote(client, s, payload)
      response.assertStatus(422)
      assert.equal(response.body().code, 'VALIDATION_ERROR', JSON.stringify(payload).slice(0, 80))
    }

    const edge = await quote(client, s, { items: [{ product_id: s.productId, quantity: 20 }] })
    edge.assertStatus(200)
    assert.equal(edge.body().data.total, '200.00')
  })

  test('produto indisponível, inexistente ou de outro restaurante: ITEM_UNAVAILABLE', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const other = await setup()
    await db.from('products').where('id', s.productId).update({ is_available: false })
    for (const productId of [s.productId, other.productId, randomUUID()]) {
      const response = await quote(client, s, { items: [{ product_id: productId, quantity: 1 }] })
      response.assertStatus(422)
      assert.equal(response.body().code, 'ITEM_UNAVAILABLE')
      assert.deepEqual(response.body().details, { product_ids: [productId], addon_ids: [] })
    }
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
      const response = await quote(client, s, {
        items: [{ product_id: s.productId, quantity: 1, addon_ids: [addonId] }],
      })
      response.assertStatus(422)
      assert.equal(response.body().code, 'ITEM_UNAVAILABLE')
      assert.deepEqual(response.body().details, { product_ids: [], addon_ids: [addonId] })
    }
  })

  test('rate limit: 30 por minuto por IP e restaurante, com contador próprio', async ({
    client,
  }) => {
    const original = env.get('LIMITER_QUOTE_PER_MINUTE')
    env.set('LIMITER_QUOTE_PER_MINUTE', '3')
    try {
      const s = await setup()
      const other = await setup()
      const payload = (target: Setup) => ({
        items: [{ product_id: target.productId, quantity: 1 }],
      })
      for (let i = 0; i < 3; i++) (await quote(client, s, payload(s))).assertStatus(200)
      ;(await quote(client, s, payload(s))).assertStatus(429)
      ;(await quote(client, other, payload(other))).assertStatus(200)
    } finally {
      env.set('LIMITER_QUOTE_PER_MINUTE', String(original))
    }
  })
})

test.group('POST /public/restaurants/:slug/cart/quote | sem rastro', (group) => {
  group.each.setup(resetState)

  function captureQueries() {
    const queries: string[] = []
    const knex = db.connection().getWriteClient()
    const listener = (query: { sql: string }) => queries.push(query.sql.toLowerCase())
    knex.on('query', listener)
    return { queries, stop: () => knex.off('query', listener) }
  }

  test('cotações (válidas e inválidas) não alteram tabelas nem next_order_number', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const items = [{ product_id: s.productId, quantity: 2, addon_ids: [s.addonId] }]
    for (let i = 0; i < 3; i++) (await quote(client, s, { items })).assertStatus(200)
    ;(await quote(client, s, { items: [{ product_id: randomUUID(), quantity: 1 }] })).assertStatus(
      422
    )
    ;(await quote(client, s, { items: [] })).assertStatus(422)

    assert.deepEqual(await tableCounts(), ZERO)
    assert.equal(await nextNumber(s.id), 1001)
    // O primeiro pedido depois das cotações recebe o primeiro número
    const created = await createOrder(client, s, items)
    created.assertStatus(201)
    assert.equal(created.body().data.order_number, 1001)
  })

  test('a cotação só lê: sem transação, sem trava e sem escrita', async ({ client, assert }) => {
    const s = await setup()
    const items = [{ product_id: s.productId, quantity: 1, addon_ids: [s.addonId] }]

    const capture = captureQueries()
    ;(await quote(client, s, { items })).assertStatus(200)
    capture.stop()
    assert.isAbove(capture.queries.length, 0)
    for (const sql of capture.queries) {
      assert.match(sql, /^select /, sql)
      assert.notInclude(sql, 'for share')
      assert.notInclude(sql, 'for update')
    }

    // Controle: a criação do pedido usa transação e FOR SHARE
    const control = captureQueries()
    ;(await createOrder(client, s, items)).assertStatus(201)
    control.stop()
    assert.isTrue(control.queries.some((sql) => sql.includes('for share')))
    assert.isTrue(control.queries.some((sql) => sql.startsWith('insert into "orders"')))
  })
})

test.group('Rotas públicas | resolução do restaurante pelo slug (regressão)', (group) => {
  group.each.setup(resetState)

  test('slug malformado, inexistente ou inativo: o mesmo 404 no cardápio, no pedido e na cotação', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    await db.from('restaurants').where('id', s.id).update({ is_active: false })
    const slugs = [s.slug, 'nao-existe', 'Slug_Invalido', 'a'.repeat(61)]
    const payload = { items: [{ product_id: s.productId, quantity: 1 }] }

    for (const slug of slugs) {
      const menu = await client.get(menuUrl(slug))
      const order = await client
        .post(orderUrl(slug))
        .header('Idempotency-Key', randomUUID())
        .json(orderBody(s, payload.items))
      const cart = await client.post(quoteUrl(slug)).json(payload)
      for (const response of [menu, order, cart]) response.assertStatus(404)
      assert.deepEqual(order.body(), menu.body())
      assert.deepEqual(cart.body(), menu.body())
    }
    assert.deepEqual(await tableCounts(), ZERO)
  })

  test('restaurante ativo continua respondendo nos três fluxos', async ({ client, assert }) => {
    const s = await setup()
    const items = [{ product_id: s.productId, quantity: 1 }]
    const menu = await client.get(menuUrl(s.slug))
    menu.assertStatus(200)
    assert.equal(menu.body().data.restaurant.slug, s.slug)
    ;(await quote(client, s, { items })).assertStatus(200)
    ;(await createOrder(client, s, items)).assertStatus(201)
  })
})
