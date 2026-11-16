import { randomBytes, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { resetState } from '#tests/helpers'
import {
  counts,
  insertId,
  newKey,
  nextNumber,
  orderBody,
  postOrder,
  setup,
  type Client,
  type Setup,
} from '#tests/order_helpers'

// F5-T4: GET /public/orders/:trackingToken. O token é segredo: dados mínimos, 404 uniforme.

const trackUrl = (token: string) => `/api/v1/public/orders/${token}`

// Dados que nunca podem aparecer na resposta de acompanhamento
const CUSTOMER_NAME = 'Zé Segredo da Silva'
const CUSTOMER_PHONE = '11987654321'
const NOTES = 'observação-confidencial-123'

async function createOrder(client: Client, s: Setup, extra: Record<string, unknown> = {}) {
  const response = await postOrder(
    client,
    s,
    newKey(),
    orderBody(s, {
      customer: { name: CUSTOMER_NAME, phone: CUSTOMER_PHONE },
      notes: NOTES,
      items: [{ product_id: s.productId, quantity: 2, addon_ids: [s.addonId, s.addon2Id] }],
      ...extra,
    })
  )
  response.assertStatus(201)
  return response.body().data as { order_number: number; tracking_token: string; total: string }
}

const HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }

test.group('GET /public/orders/:trackingToken | resposta mínima', (group) => {
  group.each.setup(resetState)

  test('token válido devolve só os dados do contrato', async ({ client, assert }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    const response = await client.get(trackUrl(order.tracking_token))
    response.assertStatus(200)
    for (const [name, value] of Object.entries(HEADERS)) {
      assert.equal(response.header(name), value, name)
    }

    const { data } = response.body()
    assert.deepEqual(Object.keys(data).sort(), [
      'created_at',
      'fulfillment_type',
      'items',
      'order_number',
      'restaurant_name',
      'status',
      'total',
      'updated_at',
    ])
    assert.equal(data.restaurant_name, (await db.from('restaurants').first()).name)
    assert.equal(data.order_number, 1001)
    assert.equal(data.status, 'pending')
    assert.equal(data.fulfillment_type, 'dine_in')
    // 2 × (10.00 + 2.00 + 1.50) = 27.00
    assert.equal(data.total, '27.00')
    assert.deepEqual(data.items, [
      { name: 'Hambúrguer', quantity: 2, addons: ['Bacon', 'Queijo'], subtotal: '27.00' },
    ])
    assert.isString(data.created_at)
    assert.isString(data.updated_at)
  })

  test('a resposta não contém dados pessoais, identificadores internos nem o token', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    const response = await client.get(trackUrl(order.tracking_token))
    response.assertStatus(200)
    const text = JSON.stringify(response.body())

    const row = await db.from('orders').where('restaurant_id', s.id).first()
    const item = await db.from('order_items').where('order_id', row.id).first()
    const forbidden = [
      CUSTOMER_NAME,
      'Zé',
      CUSTOMER_PHONE,
      NOTES,
      order.tracking_token,
      'tracking_token',
      'customer',
      'phone',
      'notes',
      'table',
      'Mesa 5',
      'payment',
      'idempotency',
      'restaurant_id',
      'product_id',
      row.id,
      item.id,
      s.id,
      s.productId,
      s.addonId,
      s.addon2Id,
    ]
    for (const value of forbidden.filter(Boolean)) {
      assert.notInclude(text, value as string, `vazou: ${value}`)
    }
    assert.notInclude(text, '"id"')
  })

  test('retirada: devolve a modalidade e nada do cliente', async ({ client, assert }) => {
    const s = await setup()
    const payload = orderBody(s, {
      customer: { name: CUSTOMER_NAME, phone: CUSTOMER_PHONE },
      fulfillment_type: 'pickup',
    })
    delete (payload as Record<string, unknown>).table_identifier
    const created = await postOrder(client, s, newKey(), payload)
    created.assertStatus(201)
    const response = await client.get(trackUrl(created.body().data.tracking_token))
    response.assertStatus(200)
    assert.equal(response.body().data.fulfillment_type, 'pickup')
    assert.notInclude(JSON.stringify(response.body()), CUSTOMER_PHONE)
  })

  test('itens em ordem canônica (nome) e adicionais por nome', async ({ client, assert }) => {
    const s = await setup()
    const zebra = await insertId('products', {
      restaurant_id: s.id,
      category_id: s.categoryId,
      name: 'Zebra',
      price: '1.00',
    })
    const order = await createOrder(client, s, {
      items: [
        { product_id: zebra, quantity: 1 },
        { product_id: s.productId, quantity: 1, addon_ids: [s.addon2Id, s.addonId] },
      ],
    })
    const response = await client.get(trackUrl(order.tracking_token))
    const { items } = response.body().data
    assert.deepEqual(
      items.map((item: { name: string }) => item.name),
      ['Hambúrguer', 'Zebra']
    )
    assert.deepEqual(items[0].addons, ['Bacon', 'Queijo'])
  })
})

test.group('GET /public/orders/:trackingToken | 404 uniforme', (group) => {
  group.each.setup(resetState)

  test('token malformado, inexistente ou que não é o token respondem o mesmo 404', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    const row = await db.from('orders').where('restaurant_id', s.id).first()

    const unknownButValid = randomBytes(32).toString('base64url')
    const attempts = [
      unknownButValid,
      order.tracking_token.slice(0, 42), // curto
      `${order.tracking_token}a`, // longo
      order.tracking_token.slice(0, 42) + '!', // caractere inválido
      order.tracking_token.slice(0, 42) + '=', // padding
      order.tracking_token.slice(0, 10), // busca parcial
      order.tracking_token.toLowerCase() === order.tracking_token
        ? order.tracking_token.toUpperCase()
        : order.tracking_token.toLowerCase(), // caixa alterada
      row.id, // id do pedido
      String(order.order_number), // número do pedido
      'x'.repeat(500),
      '%20',
      'a'.repeat(43).replace(/a/g, '.'),
    ]
    const bodies = new Set<string>()
    for (const attempt of attempts) {
      const response = await client.get(trackUrl(encodeURIComponent(attempt)))
      response.assertStatus(404)
      bodies.add(JSON.stringify(response.body()))
      for (const [name, value] of Object.entries(HEADERS)) {
        assert.equal(response.header(name), value, `${name} no 404`)
      }
    }
    assert.equal(bodies.size, 1, 'o corpo do 404 deve ser idêntico em todos os casos')
    assert.deepEqual(JSON.parse([...bodies][0]), {
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
    })
  })

  test('não há busca por id, número do pedido nem listagem', async ({ client }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    const row = await db.from('orders').where('restaurant_id', s.id).first()
    ;(await client.get(trackUrl(row.id))).assertStatus(404)
    ;(await client.get(trackUrl(String(order.order_number)))).assertStatus(404)
    ;(await client.get('/api/v1/public/orders')).assertStatus(404)
    ;(await client.get('/api/v1/public/orders/')).assertStatus(404)
  })
})

test.group('GET /public/orders/:trackingToken | isolamento e estabilidade', (group) => {
  group.each.setup(resetState)

  test('cada token devolve só o próprio pedido, mesmo entre restaurantes', async ({
    client,
    assert,
  }) => {
    const a = await setup()
    const b = await setup()
    const first = await createOrder(client, a)
    const second = await createOrder(client, a, {
      items: [{ product_id: a.productId, quantity: 1 }],
    })
    const other = await createOrder(client, b, {
      customer: { name: 'Outra Cliente', phone: '11911112222' },
      items: [{ product_id: b.productId, quantity: 5 }],
    })

    const r1 = (await client.get(trackUrl(first.tracking_token))).body().data
    const r2 = (await client.get(trackUrl(second.tracking_token))).body().data
    const r3 = (await client.get(trackUrl(other.tracking_token))).body().data
    assert.deepEqual([r1.order_number, r2.order_number, r3.order_number], [1001, 1002, 1001])
    assert.equal(r1.total, '27.00')
    assert.equal(r2.total, '10.00')
    assert.equal(r3.total, '50.00')
    assert.lengthOf(r1.items, 1)
    assert.lengthOf(r2.items, 1)
    assert.equal(r3.items[0].quantity, 5)
    assert.notInclude(JSON.stringify(r3), 'Outra Cliente')
    const restaurantB = await db.from('restaurants').where('id', b.id).first()
    assert.equal(r3.restaurant_name, restaurantB.name)
    assert.notEqual(r1.restaurant_name, r3.restaurant_name)
  })

  test('mostra o status atual do pedido', async ({ client, assert }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    await db.from('orders').where('restaurant_id', s.id).update({ status: 'preparing' })
    const response = await client.get(trackUrl(order.tracking_token))
    assert.equal(response.body().data.status, 'preparing')
  })

  test('mudanças no catálogo, na mesa e no restaurante não alteram os snapshots', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    const before = (await client.get(trackUrl(order.tracking_token))).body().data

    await db
      .from('products')
      .where('id', s.productId)
      .update({ name: 'Outro nome', price: '99.00' })
    await db.from('product_addons').where('id', s.addonId).update({ name: 'Renomeado' })
    await db.from('restaurant_tables').where('restaurant_id', s.id).delete()
    const same = (await client.get(trackUrl(order.tracking_token))).body().data
    assert.deepEqual(same, before)

    await db.from('product_product_addons').where('restaurant_id', s.id).delete()
    await db.from('products').where('id', s.productId).delete()
    await db.from('product_addons').where('restaurant_id', s.id).delete()
    const afterDelete = (await client.get(trackUrl(order.tracking_token))).body().data
    assert.deepEqual(afterDelete, before)
  })

  test('restaurante inativo: o acompanhamento continua com 200', async ({ client, assert }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    await db.from('restaurants').where('id', s.id).update({ is_active: false })
    const response = await client.get(trackUrl(order.tracking_token))
    response.assertStatus(200)
    assert.equal(response.body().data.order_number, 1001)
  })

  test('é só leitura: sem sessão, sem escrita e sem consumir número', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const order = await createOrder(client, s)
    const before = await counts()
    const knex = db.connection().getWriteClient()
    const queries: string[] = []
    const listener = (query: { sql: string }) => queries.push(query.sql.toLowerCase())
    knex.on('query', listener)
    try {
      for (let i = 0; i < 3; i++) {
        const response = await client
          .get(trackUrl(order.tracking_token))
          .header('Cookie', 'cardapio_session=lixo')
        response.assertStatus(200)
      }
      ;(await client.get(trackUrl(randomUUID()))).assertStatus(404)
    } finally {
      knex.off('query', listener)
    }
    assert.isAbove(queries.length, 0)
    for (const sql of queries) assert.match(sql, /^select /, sql)
    assert.deepEqual(await counts(), before)
    assert.equal(await nextNumber(s.id), 1002)
  })
})

test.group('GET /public/orders/:trackingToken | rate limit', (group) => {
  group.each.setup(resetState)

  test('30 consultas por minuto por IP; o 429 também leva os cabeçalhos do token', async ({
    client,
    assert,
  }) => {
    const original = env.get('LIMITER_TRACKING_PER_MINUTE')
    env.set('LIMITER_TRACKING_PER_MINUTE', '3')
    try {
      const s = await setup()
      const order = await createOrder(client, s)
      for (let i = 0; i < 3; i++)
        (await client.get(trackUrl(order.tracking_token))).assertStatus(200)
      const limited = await client.get(trackUrl(order.tracking_token))
      limited.assertStatus(429)
      assert.equal(limited.body().code, 'RATE_LIMITED')
      for (const [name, value] of Object.entries(HEADERS)) {
        assert.equal(limited.header(name), value, `${name} no 429`)
      }
      assert.notInclude(JSON.stringify(limited.body()), order.tracking_token)
      // tokens inválidos também contam no mesmo contador por IP
      ;(await client.get(trackUrl(randomUUID()))).assertStatus(429)
    } finally {
      env.set('LIMITER_TRACKING_PER_MINUTE', String(original))
    }
  })

  test('o limite padrão é 30 por minuto', async ({ client }) => {
    const original = env.get('LIMITER_TRACKING_PER_MINUTE')
    env.set('LIMITER_TRACKING_PER_MINUTE', '30')
    try {
      const token = randomBytes(32).toString('base64url')
      for (let i = 0; i < 30; i++) (await client.get(trackUrl(token))).assertStatus(404)
      ;(await client.get(trackUrl(token))).assertStatus(429)
    } finally {
      env.set('LIMITER_TRACKING_PER_MINUTE', String(original))
    }
  })
})
