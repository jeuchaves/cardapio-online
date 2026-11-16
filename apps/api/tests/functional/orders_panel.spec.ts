import { randomBytes, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  authed,
  createRestaurantWithTeam,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'
import { counts, insertId, newKey, nextNumber, orderBody, postOrder } from '#tests/order_helpers'

// F5-T6: GET /tenant/:restaurantId/orders e /orders/:id (owner e staff). Só leitura.

const NAME = 'Zé Segredo da Silva'
const PHONE = '11987654321'
const NOTES = 'observação-confidencial-123'

const list = (restaurantId: string, query = '') =>
  `/api/v1/tenant/${restaurantId}/orders${query ? `?${query}` : ''}`
const detail = (restaurantId: string, id: string) => `/api/v1/tenant/${restaurantId}/orders/${id}`

type Team = Awaited<ReturnType<typeof createRestaurantWithTeam>>

// Cardápio mínimo do restaurante, no formato do helper compartilhado de pedidos
async function menuFor(team: Team) {
  const id = team.restaurant.id
  const tableIdentifier = `mesa${id.slice(0, 6)}`
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
  return {
    id,
    slug: team.restaurant.slug,
    tableIdentifier,
    categoryId,
    productId,
    addonId,
    addon2Id,
  }
}

// Pedido feito pela API pública, como o cliente faz
async function createOrder(client: unknown, menu: Awaited<ReturnType<typeof menuFor>>) {
  const response = await postOrder(
    client,
    menu,
    newKey(),
    orderBody(menu, {
      customer: { name: NAME, phone: PHONE },
      notes: NOTES,
      items: [
        { product_id: menu.productId, quantity: 2, addon_ids: [menu.addonId, menu.addon2Id] },
      ],
    })
  )
  response.assertStatus(201)
  const row = await db
    .from('orders')
    .where('restaurant_id', menu.id)
    .where('order_number', response.body().data.order_number)
    .first()
  return { id: row.id as string, token: response.body().data.tracking_token as string }
}

// Pedido direto no banco, para controlar data, status e número
let sequence = 0
async function insertOrder(
  restaurantId: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  sequence += 1
  return insertId('orders', {
    restaurant_id: restaurantId,
    order_number: 1000 + sequence,
    customer_name: `Cliente ${sequence}`,
    customer_phone: '11999990000',
    fulfillment_type: 'pickup',
    payment_method: 'cash',
    status: 'pending',
    total: '10.00',
    tracking_token: randomBytes(32).toString('base64url'),
    idempotency_key: randomUUID(),
    idempotency_hash: 'hash',
    ...overrides,
  })
}

async function loginOwner(client: unknown, team: Team) {
  return loginAndGetCookie(client as any, team.owner.email)
}

test.group('GET /tenant/:restaurantId/orders | lista', (group) => {
  group.each.setup(resetState)

  test('owner e staff veem só os pedidos do próprio restaurante, mais recentes primeiro', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const sameMoment = '2026-03-10T15:00:00Z'
    const first = await insertOrder(a.restaurant.id, { created_at: '2026-03-09T15:00:00Z' })
    const tieLow = await insertOrder(a.restaurant.id, { created_at: sameMoment })
    const tieHigh = await insertOrder(a.restaurant.id, { created_at: sameMoment })
    await insertOrder(b.restaurant.id)

    for (const user of [a.owner, a.staff]) {
      const cookie = await loginAndGetCookie(client, user.email)
      const response = await authed(client, 'get', list(a.restaurant.id), cookie)
      response.assertStatus(200)
      const { data, meta } = response.body()
      assert.deepEqual(
        data.map((order: { id: string }) => order.id),
        [tieHigh, tieLow, first]
      )
      assert.deepEqual(meta, { page: 1, per_page: 20, total: 3 })
    }
  })

  test('cada item traz exatamente o contrato, sem telefone, observações, mesa nem token', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    await createOrder(client, menu)
    const cookie = await loginOwner(client, team)
    const response = await authed(client, 'get', list(team.restaurant.id), cookie)
    response.assertStatus(200)
    const [order] = response.body().data
    assert.deepEqual(Object.keys(order).sort(), [
      'created_at',
      'customer_name',
      'fulfillment_type',
      'id',
      'order_number',
      'status',
      'total',
    ])
    assert.equal(order.customer_name, NAME)
    assert.equal(order.total, '27.00')
    assert.isString(order.total)
    const text = JSON.stringify(response.body())
    for (const hidden of [PHONE, NOTES, 'Mesa 5', 'tracking', 'idempotency', 'restaurant_id']) {
      assert.notInclude(text, hidden, hidden)
    }
  })

  test('paginação: meta, segunda página, página além do fim e limite de per_page', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    for (let i = 0; i < 5; i++) {
      await insertOrder(team.restaurant.id, { created_at: `2026-03-0${i + 1}T12:00:00Z` })
    }
    const cookie = await loginOwner(client, team)
    const get = (query: string) => authed(client, 'get', list(team.restaurant.id, query), cookie)

    const second = await get('page=2&per_page=2')
    second.assertStatus(200)
    assert.lengthOf(second.body().data, 2)
    assert.deepEqual(second.body().meta, { page: 2, per_page: 2, total: 5 })

    const beyond = await get('page=9&per_page=2')
    beyond.assertStatus(200)
    assert.lengthOf(beyond.body().data, 0)
    assert.equal(beyond.body().meta.total, 5)

    ;(await get('per_page=100')).assertStatus(200)
    ;(await get('per_page=101')).assertStatus(422)
    ;(await get('per_page=0')).assertStatus(422)
    ;(await get('page=0')).assertStatus(422)
    ;(await get('page=1.5')).assertStatus(422)
  })

  test('filtro por status, sozinho e combinado com a data', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const id = team.restaurant.id
    const readyToday = await insertOrder(id, {
      status: 'ready',
      created_at: '2026-03-10T15:00:00Z',
    })
    await insertOrder(id, { status: 'ready', created_at: '2026-03-12T15:00:00Z' })
    await insertOrder(id, { status: 'pending', created_at: '2026-03-10T15:00:00Z' })
    const cookie = await loginOwner(client, team)
    const get = (query: string) => authed(client, 'get', list(id, query), cookie)

    const ready = await get('status=ready')
    assert.equal(ready.body().meta.total, 2)
    const combined = await get('status=ready&date=2026-03-10')
    assert.deepEqual(
      combined.body().data.map((order: { id: string }) => order.id),
      [readyToday]
    )
    assert.equal(combined.body().meta.total, 1)
  })

  test('filtro por data usa o dia civil de America/Sao_Paulo, início inclusive e fim exclusivo', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = team.restaurant.id
    // Em São Paulo (UTC-3), o dia 10/03 vai de 03:00Z do dia 10 até 03:00Z do dia 11, exclusive
    await insertOrder(id, { created_at: '2026-03-10T02:59:59Z' }) // 09/03 23:59:59
    const start = await insertOrder(id, { created_at: '2026-03-10T03:00:00Z' }) // 10/03 00:00:00
    const end = await insertOrder(id, { created_at: '2026-03-11T02:59:59Z' }) // 10/03 23:59:59
    await insertOrder(id, { created_at: '2026-03-11T03:00:00Z' }) // 11/03 00:00:00
    const cookie = await loginOwner(client, team)

    const response = await authed(client, 'get', list(id, 'date=2026-03-10'), cookie)
    response.assertStatus(200)
    assert.sameMembers(
      response.body().data.map((order: { id: string }) => order.id),
      [start, end]
    )
    assert.equal(response.body().meta.total, 2)
  })

  test('parâmetros inválidos ou desconhecidos respondem 422', async ({ client }) => {
    const team = await createRestaurantWithTeam()
    const cookie = await loginOwner(client, team)
    const id = team.restaurant.id
    for (const query of [
      'status=entregue',
      'status=',
      'date=abc',
      'date=10/03/2026',
      'date=2026-02-30',
      'date=2026-13-01',
      'restaurant_id=x',
      'search=maria',
    ]) {
      const response = await authed(client, 'get', list(id, query), cookie)
      response.assertStatus(422)
    }
  })

  test('restaurante sem pedidos: lista vazia', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const cookie = await loginOwner(client, team)
    const response = await authed(client, 'get', list(team.restaurant.id), cookie)
    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: [], meta: { page: 1, per_page: 20, total: 0 } })
  })
})

test.group('GET /tenant/:restaurantId/orders/:id | detalhe', (group) => {
  group.each.setup(resetState)

  test('devolve o contrato completo, com cliente, mesa, itens e histórico', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    const order = await createOrder(client, menu)
    const cookie = await loginOwner(client, team)

    for (const user of [team.owner, team.staff]) {
      const session = user === team.owner ? cookie : await loginAndGetCookie(client, user.email)
      const response = await authed(client, 'get', detail(team.restaurant.id, order.id), session)
      response.assertStatus(200)
      const { data } = response.body()
      assert.deepEqual(Object.keys(data).sort(), [
        'created_at',
        'customer',
        'fulfillment_type',
        'history',
        'id',
        'items',
        'notes',
        'order_number',
        'payment_method',
        'status',
        'table',
        'total',
        'updated_at',
      ])
      assert.equal(data.id, order.id)
      assert.equal(data.order_number, 1001)
      assert.equal(data.status, 'pending')
      assert.equal(data.fulfillment_type, 'dine_in')
      assert.equal(data.payment_method, 'cash')
      assert.deepEqual(data.customer, { name: NAME, phone: PHONE })
      assert.equal(data.table, 'Mesa 5')
      assert.equal(data.notes, NOTES)
      assert.equal(data.total, '27.00')
      assert.deepEqual(data.items, [
        {
          name: 'Hambúrguer',
          quantity: 2,
          unit_price: '10.00',
          addons: [
            { name: 'Bacon', unit_price: '2.00' },
            { name: 'Queijo', unit_price: '1.50' },
          ],
          subtotal: '27.00',
        },
      ])
      assert.lengthOf(data.history, 1)
      assert.equal(data.history[0].previous_status, null)
      assert.equal(data.history[0].new_status, 'pending')
      assert.deepEqual(Object.keys(data.history[0]).sort(), [
        'created_at',
        'new_status',
        'previous_status',
      ])
    }
  })

  test('nunca devolve token, chaves de idempotência nem restaurante', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    const order = await createOrder(client, menu)
    const cookie = await loginOwner(client, team)
    const response = await authed(client, 'get', detail(team.restaurant.id, order.id), cookie)
    const text = JSON.stringify(response.body())
    const row = await db.from('orders').where('id', order.id).first()
    for (const hidden of [
      order.token,
      row.idempotency_key,
      row.idempotency_hash,
      team.restaurant.id,
      menu.productId,
      menu.addonId,
      'tracking',
      'idempotency',
      'restaurant_id',
    ]) {
      assert.notInclude(text, hidden, `vazou: ${hidden}`)
    }
  })

  test('mostra o status atual e o histórico completo, em ordem', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    const order = await createOrder(client, menu)
    await db.from('orders').where('id', order.id).update({ status: 'confirmed' })
    await db.table('order_status_history').insert({
      restaurant_id: team.restaurant.id,
      order_id: order.id,
      previous_status: 'pending',
      new_status: 'confirmed',
      changed_by_user_id: team.owner.id,
      created_at: new Date(Date.now() + 1000),
    })
    const cookie = await loginOwner(client, team)
    const { data } = (
      await authed(client, 'get', detail(team.restaurant.id, order.id), cookie)
    ).body()
    assert.equal(data.status, 'confirmed')
    assert.deepEqual(
      data.history.map((row: { new_status: string }) => row.new_status),
      ['pending', 'confirmed']
    )
    assert.notInclude(JSON.stringify(data), team.owner.id)
  })

  test('snapshots não mudam quando produto, adicional e mesa são alterados ou excluídos', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    const order = await createOrder(client, menu)
    const cookie = await loginOwner(client, team)
    const get = async () =>
      (await authed(client, 'get', detail(team.restaurant.id, order.id), cookie)).body().data
    const before = await get()

    await db.from('products').where('id', menu.productId).update({ name: 'Outro', price: '99.00' })
    await db.from('product_addons').where('id', menu.addonId).update({ name: 'Renomeado' })
    assert.deepEqual(await get(), before)

    await db.from('restaurant_tables').where('restaurant_id', menu.id).delete()
    await db.from('product_product_addons').where('restaurant_id', menu.id).delete()
    await db.from('products').where('id', menu.productId).delete()
    await db.from('product_addons').where('restaurant_id', menu.id).delete()
    assert.deepEqual(await get(), before)
  })

  test('id inexistente ou malformado responde 404 uniforme', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const cookie = await loginOwner(client, team)
    const bodies = new Set<string>()
    for (const id of [randomUUID(), 'abc', '123', 'x'.repeat(100)]) {
      const response = await authed(client, 'get', detail(team.restaurant.id, id), cookie)
      response.assertStatus(404)
      bodies.add(JSON.stringify(response.body()))
    }
    assert.equal(bodies.size, 1)
  })
})

test.group('pedidos do painel | autorização e isolamento A × B', (group) => {
  group.each.setup(resetState)

  test('sem sessão: 401', async ({ client }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    ;(await client.get(list(team.restaurant.id))).assertStatus(401)
    ;(await client.get(detail(team.restaurant.id, id))).assertStatus(401)
  })

  test('platform_admin sem vínculo é recusado (404) na lista e no detalhe', async ({ client }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const admin = await createUser({ isPlatformAdmin: true })
    const cookie = await loginAndGetCookie(client, admin.email)
    ;(await authed(client, 'get', list(team.restaurant.id), cookie)).assertStatus(404)
    ;(await authed(client, 'get', detail(team.restaurant.id, id), cookie)).assertStatus(404)
  })

  test('vínculo inativo: 404', async ({ client }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const former = await createUser()
    await link(former, team.restaurant, 'staff', false)
    // Sem outro vínculo ativo o login falharia; o usuário precisa de uma sessão válida
    await link(former, (await createRestaurantWithTeam()).restaurant, 'staff')
    const cookie = await loginAndGetCookie(client, former.email)
    ;(await authed(client, 'get', list(team.restaurant.id), cookie)).assertStatus(404)
    ;(await authed(client, 'get', detail(team.restaurant.id, id), cookie)).assertStatus(404)
  })

  test('senha temporária pendente: 403', async ({ client }) => {
    const team = await createRestaurantWithTeam()
    const user = await createUser({ mustChangePassword: true })
    await link(user, team.restaurant, 'staff')
    const cookie = await loginAndGetCookie(client, user.email)
    const response = await authed(client, 'get', list(team.restaurant.id), cookie)
    response.assertStatus(403)
    response.assertBodyContains({ code: 'PASSWORD_CHANGE_REQUIRED' })
  })

  test('leitura: usuário do restaurante A não lista nem detalha pedidos do B, mesmo com o id', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const orderA = await insertOrder(a.restaurant.id)
    const orderB = await insertOrder(b.restaurant.id, { customer_name: 'Cliente do B' })
    const cookie = await loginOwner(client, a)

    const own = await authed(client, 'get', list(a.restaurant.id), cookie)
    assert.deepEqual(
      own.body().data.map((order: { id: string }) => order.id),
      [orderA]
    )
    assert.notInclude(JSON.stringify(own.body()), 'Cliente do B')

    // restaurante B na URL: sem vínculo
    ;(await authed(client, 'get', list(b.restaurant.id), cookie)).assertStatus(404)
    ;(await authed(client, 'get', detail(b.restaurant.id, orderB), cookie)).assertStatus(404)
    // id do pedido do B sob o restaurante A: o filtro por restaurante não o encontra
    const crossed = await authed(client, 'get', detail(a.restaurant.id, orderB), cookie)
    crossed.assertStatus(404)
    assert.notInclude(JSON.stringify(crossed.body()), 'Cliente do B')
  })

  test('as consultas ao banco filtram explicitamente por restaurant_id', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    const order = await createOrder(client, menu)
    const cookie = await loginOwner(client, team)

    const knex = db.connection().getWriteClient()
    const queries: { sql: string; bindings: unknown[] }[] = []
    const listener = (query: { sql: string; bindings?: unknown[] }) =>
      queries.push({ sql: query.sql.toLowerCase(), bindings: query.bindings ?? [] })
    knex.on('query', listener)
    try {
      ;(await authed(client, 'get', list(team.restaurant.id), cookie)).assertStatus(200)
      ;(await authed(client, 'get', detail(team.restaurant.id, order.id), cookie)).assertStatus(200)
    } finally {
      knex.off('query', listener)
    }
    const orderQueries = queries.filter((query) =>
      /from "(orders|order_items|order_item_addons|order_status_history)"/.test(query.sql)
    )
    assert.isAbove(orderQueries.length, 0)
    for (const query of orderQueries) {
      assert.include(query.sql, '"restaurant_id"', query.sql)
      assert.include(query.bindings, team.restaurant.id)
      assert.match(query.sql, /^select /)
    }
  })

  test('é só leitura: contagens e numeração não mudam', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const menu = await menuFor(team)
    const order = await createOrder(client, menu)
    const cookie = await loginOwner(client, team)
    const before = await counts()
    const next = await nextNumber(team.restaurant.id)
    ;(await authed(client, 'get', list(team.restaurant.id), cookie)).assertStatus(200)
    ;(await authed(client, 'get', detail(team.restaurant.id, order.id), cookie)).assertStatus(200)
    assert.deepEqual(await counts(), before)
    assert.equal(await nextNumber(team.restaurant.id), next)
  })
})
