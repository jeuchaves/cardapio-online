import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import router from '@adonisjs/core/services/router'
import Restaurant from '#models/restaurant'
import {
  authed,
  createRestaurant,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'
import { counts, newKey, orderBody, postOrder, setup } from '#tests/order_helpers'
import { ORDER_STATUSES } from '#validators/order'

// F5-T10: isolamento de pedidos entre restaurantes (ROADMAP seção 6 e 8.5): leitura (GET),
// alteração (PATCH) e exclusão (DELETE) com dois restaurantes, a matriz completa de usuários e
// os ids reais do restaurante B conhecidos pelo atacante.

type Client = any
type Tenant = Awaited<ReturnType<typeof createTenant>>
type Queries = { sql: string; bindings: unknown[] }[]

const base = (restaurantId: string) => `/api/v1/tenant/${restaurantId}/orders`
const ORDER_TABLES =
  /(from|into|update) "(orders|order_items|order_item_addons|order_status_history)"/

async function createTenant() {
  const s = await setup()
  const restaurant = await Restaurant.findOrFail(s.id)
  const owner = await createUser()
  const staff = await createUser()
  await link(owner, restaurant, 'owner')
  await link(staff, restaurant, 'staff')
  return { s, restaurant, owner, staff }
}

// Um pedido em cada status. Os dois primeiros são criados pela API e alterados por um PATCH real
// (itens, adicionais e histórico verdadeiros); os demais têm o status forçado no banco.
async function seedOrders(client: Client, tenant: Tenant) {
  const ids: Record<string, string> = {}
  const cookie = await loginAndGetCookie(client, tenant.owner.email)
  for (const status of ORDER_STATUSES) {
    const created = await postOrder(client, tenant.s, newKey(), orderBody(tenant.s))
    created.assertStatus(201)
    const row = await db
      .from('orders')
      .where('restaurant_id', tenant.s.id)
      .where('order_number', created.body().data.order_number)
      .select('id')
      .first()
    ids[status] = row.id
    if (status === 'confirmed') {
      const patched = await authed(
        client,
        'patch',
        `${base(tenant.s.id)}/${row.id}/status`,
        cookie
      ).json({ status: 'confirmed' })
      patched.assertStatus(200)
    } else if (status !== 'pending') {
      await db.from('orders').where('id', row.id).update({ status })
    }
  }
  return ids
}

// Estado completo do restaurante: pedidos, itens, adicionais, histórico e numeração
async function snapshot(restaurantId: string) {
  const rows = (table: string) =>
    db.from(table).where('restaurant_id', restaurantId).orderBy('id').select()
  const restaurant = await db.from('restaurants').where('id', restaurantId).first()
  return JSON.stringify({
    orders: await rows('orders'),
    items: await rows('order_items'),
    addons: await rows('order_item_addons'),
    history: await rows('order_status_history'),
    next_order_number: restaurant.next_order_number,
  })
}

async function capture(action: () => Promise<void>): Promise<Queries> {
  const knex = db.connection().getWriteClient()
  const queries: Queries = []
  const listener = (query: { sql: string; bindings?: unknown[] }) =>
    queries.push({ sql: query.sql.toLowerCase(), bindings: query.bindings ?? [] })
  knex.on('query', listener)
  try {
    await action()
  } finally {
    knex.off('query', listener)
  }
  return queries
}

const orderQueries = (queries: Queries) => queries.filter((query) => ORDER_TABLES.test(query.sql))

type Attack = { label: string; method: 'get' | 'patch' | 'delete'; url: string; body?: object }

// Todas as operações de pedido que um atacante pode tentar contra o id de um pedido
function attacksOn(restaurantId: string, orderId: string): Attack[] {
  return [
    { label: 'GET detalhe', method: 'get', url: `${base(restaurantId)}/${orderId}` },
    { label: 'DELETE pedido', method: 'delete', url: `${base(restaurantId)}/${orderId}` },
    ...ORDER_STATUSES.map((status) => ({
      label: `PATCH ${status}`,
      method: 'patch' as const,
      url: `${base(restaurantId)}/${orderId}/status`,
      body: { status },
    })),
  ]
}

const listAttacks = (restaurantId: string): Attack[] => [
  { label: 'GET lista', method: 'get', url: base(restaurantId) },
  { label: 'GET lista filtrada', method: 'get', url: `${base(restaurantId)}?status=pending` },
  { label: 'DELETE coleção', method: 'delete', url: base(restaurantId) },
]

async function send(client: Client, cookie: string | null, attack: Attack) {
  const request = cookie
    ? authed(client, attack.method, attack.url, cookie)
    : client[attack.method](attack.url).header('Origin', 'http://localhost:3000')
  return attack.body ? request.json(attack.body) : request
}

// DELETE de pedido não existe (ROADMAP 5.3): 404 ou 405, nunca sucesso
function assertDenied(
  assert: any,
  attack: Attack,
  status: number,
  denied: number[] = [404],
  context = ''
) {
  const allowed = attack.method === 'delete' ? [404, 405] : denied
  assert.include(allowed, status, `${attack.label} ${context} respondeu ${status}`)
}

const bIdsOf = (ids: Record<string, string>) => Object.values(ids)

test.group('Isolamento de pedidos | quem não tem vínculo ativo com o restaurante', (group) => {
  group.each.setup(resetState)

  test('sem vínculo, vínculo inativo, platform_admin e anônimo: nada é lido, alterado nem removido', async ({
    client,
    assert,
  }) => {
    const b = await createTenant()
    const ids = await seedOrders(client, b)
    const other = await createRestaurant()

    const neverLinked = await createUser()
    await link(neverLinked, other, 'staff')
    const inactive = await createUser()
    await link(inactive, b.restaurant, 'staff', false)
    await link(inactive, other, 'staff')
    const admin = await createUser({ isPlatformAdmin: true })

    const users: [string, string | null][] = [
      ['sem vínculo', await loginAndGetCookie(client, neverLinked.email)],
      ['vínculo inativo', await loginAndGetCookie(client, inactive.email)],
      ['platform_admin', await loginAndGetCookie(client, admin.email)],
      ['anônimo', null],
    ]

    const attacks = [...listAttacks(b.s.id), ...bIdsOf(ids).flatMap((id) => attacksOn(b.s.id, id))]
    const before = await snapshot(b.s.id)
    const totals = await counts()

    for (const [who, cookie] of users) {
      const queries = await capture(async () => {
        for (const attack of attacks) {
          const response = await send(client, cookie, attack)
          // Anônimo: GET/PATCH em rota existente exigem sessão (401); DELETE não tem rota
          assertDenied(assert, attack, response.status(), cookie ? [404] : [401], who)
          if (attack.method !== 'delete')
            assert.notInclude(JSON.stringify(response.body()), 'Maria')
        }
      })
      // O vínculo é checado antes de qualquer consulta de pedido
      assert.lengthOf(orderQueries(queries), 0, who)
    }

    assert.equal(await snapshot(b.s.id), before)
    assert.deepEqual(await counts(), totals)
  })
})

test.group('Isolamento de pedidos | restaurante A não alcança o restaurante B', (group) => {
  group.each.setup(resetState)

  test('owner e staff de A, conhecendo os ids de B: leitura, alteração (todas as transições) e exclusão negadas', async ({
    client,
    assert,
  }) => {
    const a = await createTenant()
    const b = await createTenant()
    const idsA = await seedOrders(client, a)
    const idsB = await seedOrders(client, b)
    const before = await snapshot(b.s.id)
    const beforeA = await snapshot(a.s.id)
    const totals = await counts()

    for (const attacker of [a.owner, a.staff]) {
      const cookie = await loginAndGetCookie(client, attacker.email)

      // A lista de A mostra só pedidos de A, com ou sem filtro
      for (const query of ['', '?status=pending', '?status=cancelled', '?per_page=100']) {
        const own = await authed(client, 'get', `${base(a.s.id)}${query}`, cookie)
        own.assertStatus(200)
        const listed = own.body().data.map((order: { id: string }) => order.id)
        for (const id of bIdsOf(idsB)) assert.notInclude(listed, id)
        for (const id of listed) assert.include(bIdsOf(idsA), id)
      }

      for (const id of bIdsOf(idsB)) {
        // id de B sob o restaurante de A: o filtro por restaurante não o encontra
        for (const attack of attacksOn(a.s.id, id)) {
          const response = await send(client, cookie, attack)
          assertDenied(assert, attack, response.status(), [404], `(${attacker.email})`)
        }
        // restaurante de B na URL: sem vínculo, nega antes de consultar pedidos
        for (const attack of attacksOn(b.s.id, id)) {
          const response = await send(client, cookie, attack)
          assertDenied(assert, attack, response.status(), [404], `(URL de B, ${attacker.email})`)
        }
      }
      for (const attack of listAttacks(b.s.id)) {
        const response = await send(client, cookie, attack)
        assertDenied(assert, attack, response.status(), [404], `(lista de B, ${attacker.email})`)
      }
    }

    assert.equal(await snapshot(b.s.id), before)
    assert.equal(await snapshot(a.s.id), beforeA)
    assert.deepEqual(await counts(), totals)
  })

  test('toda consulta de pedido, de leitura ou escrita, carrega o restaurant_id do tenant autorizado', async ({
    client,
    assert,
  }) => {
    const a = await createTenant()
    const b = await createTenant()
    const idsA = await seedOrders(client, a)
    const idsB = await seedOrders(client, b)
    const cookie = await loginAndGetCookie(client, a.owner.email)

    // Ataques contra B: só podem ler (SELECT ... FOR UPDATE) e sempre filtrando por A
    const denied = await capture(async () => {
      for (const id of bIdsOf(idsB)) {
        for (const attack of attacksOn(a.s.id, id)) await send(client, cookie, attack)
      }
    })
    const deniedOrderQueries = orderQueries(denied)
    assert.isAbove(deniedOrderQueries.length, 0)
    for (const query of deniedOrderQueries) {
      assert.match(query.sql, /^select /, query.sql)
      assert.include(query.sql, '"restaurant_id"', query.sql)
      assert.include(query.bindings, a.s.id, query.sql)
      assert.notInclude(query.bindings, b.s.id, query.sql)
    }

    // Controle positivo: as operações permitidas em A (inclusive as de escrita) também filtram
    const allowed = await capture(async () => {
      ;(await authed(client, 'get', base(a.s.id), cookie)).assertStatus(200)
      ;(await authed(client, 'get', `${base(a.s.id)}/${idsA.pending}`, cookie)).assertStatus(200)
      const patched = await authed(
        client,
        'patch',
        `${base(a.s.id)}/${idsA.pending}/status`,
        cookie
      ).json({ status: 'confirmed' })
      patched.assertStatus(200)
    })
    const writes = orderQueries(allowed).filter((query) => !query.sql.startsWith('select '))
    assert.isAbove(writes.length, 0)
    for (const query of orderQueries(allowed)) {
      assert.include(query.sql, '"restaurant_id"', query.sql)
      assert.include(query.bindings, a.s.id, query.sql)
      assert.notInclude(query.bindings, b.s.id, query.sql)
    }
    assert.isTrue(writes.some((query) => query.sql.startsWith('update "orders"')))
    assert.isTrue(
      writes.some((query) => query.sql.startsWith('insert into "order_status_history"'))
    )
  })

  test('controle positivo: o dono de A lê e altera os próprios pedidos, e só eles mudam', async ({
    client,
    assert,
  }) => {
    const a = await createTenant()
    const b = await createTenant()
    const idsA = await seedOrders(client, a)
    await seedOrders(client, b)
    const beforeB = await snapshot(b.s.id)
    const cookie = await loginAndGetCookie(client, a.owner.email)

    ;(await authed(client, 'get', `${base(a.s.id)}/${idsA.preparing}`, cookie)).assertStatus(200)
    const patched = await authed(
      client,
      'patch',
      `${base(a.s.id)}/${idsA.preparing}/status`,
      cookie
    ).json({ status: 'ready' })
    patched.assertStatus(200)

    assert.equal((await db.from('orders').where('id', idsA.preparing).first()).status, 'ready')
    assert.equal(await snapshot(b.s.id), beforeB)
  })
})

test.group('Isolamento de pedidos | usuário com vínculos em dois restaurantes', (group) => {
  group.each.setup(resetState)

  test('owner em A e staff em B: cada restaurante só é alcançado pelo seu vínculo', async ({
    client,
    assert,
  }) => {
    const a = await createTenant()
    const b = await createTenant()
    const c = await createTenant()
    const idsA = await seedOrders(client, a)
    const idsB = await seedOrders(client, b)
    const idsC = await seedOrders(client, c)
    const both = await createUser()
    await link(both, a.restaurant, 'owner')
    await link(both, b.restaurant, 'staff')
    const cookie = await loginAndGetCookie(client, both.email)
    const beforeC = await snapshot(c.s.id)

    for (const [tenant, ids, otherIds] of [
      [a, idsA, idsB],
      [b, idsB, idsA],
    ] as const) {
      const listed = await authed(client, 'get', base(tenant.s.id), cookie)
      listed.assertStatus(200)
      const listedIds = listed.body().data.map((order: { id: string }) => order.id)
      for (const id of otherIds ? Object.values(otherIds) : []) assert.notInclude(listedIds, id)
      for (const id of listedIds) assert.include(Object.values(ids), id)

      // ids do outro restaurante sob este: 404 e nada muda
      for (const id of Object.values(otherIds)) {
        for (const attack of attacksOn(tenant.s.id, id)) {
          const response = await send(client, cookie, attack)
          assertDenied(assert, attack, response.status(), [404], `(${attack.url})`)
        }
      }
    }

    // Restaurante C (sem vínculo): negado, mesmo na sessão com dois vínculos
    for (const id of Object.values(idsC)) {
      for (const attack of attacksOn(c.s.id, id)) {
        assertDenied(assert, attack, (await send(client, cookie, attack)).status())
      }
    }
    assert.equal(await snapshot(c.s.id), beforeC)
  })

  test('cada vínculo altera só os pedidos do próprio restaurante', async ({ client, assert }) => {
    const a = await createTenant()
    const b = await createTenant()
    const idsA = await seedOrders(client, a)
    const idsB = await seedOrders(client, b)
    const both = await createUser()
    await link(both, a.restaurant, 'owner')
    await link(both, b.restaurant, 'staff')
    const cookie = await loginAndGetCookie(client, both.email)

    const inA = await authed(
      client,
      'patch',
      `${base(a.s.id)}/${idsA.pending}/status`,
      cookie
    ).json({ status: 'confirmed' })
    inA.assertStatus(200)
    const inB = await authed(
      client,
      'patch',
      `${base(b.s.id)}/${idsB.pending}/status`,
      cookie
    ).json({ status: 'confirmed' })
    inB.assertStatus(200)
    const cross = await authed(
      client,
      'patch',
      `${base(a.s.id)}/${idsB.ready}/status`,
      cookie
    ).json({ status: 'completed' })
    cross.assertStatus(404)

    assert.equal((await db.from('orders').where('id', idsA.pending).first()).status, 'confirmed')
    assert.equal((await db.from('orders').where('id', idsB.pending).first()).status, 'confirmed')
    assert.equal((await db.from('orders').where('id', idsB.ready).first()).status, 'ready')
  })

  test('perder o vínculo em um restaurante não afeta o outro, na mesma sessão', async ({
    client,
    assert,
  }) => {
    const a = await createTenant()
    const b = await createTenant()
    const idsA = await seedOrders(client, a)
    const idsB = await seedOrders(client, b)
    const both = await createUser()
    await link(both, a.restaurant, 'owner')
    await link(both, b.restaurant, 'staff')
    const cookie = await loginAndGetCookie(client, both.email)
    ;(await authed(client, 'get', `${base(b.s.id)}/${idsB.pending}`, cookie)).assertStatus(200)

    await db
      .from('restaurant_users')
      .where('user_id', both.id)
      .where('restaurant_id', b.s.id)
      .update({ is_active: false })
    const beforeB = await snapshot(b.s.id)

    for (const attack of attacksOn(b.s.id, idsB.pending)) {
      assertDenied(assert, attack, (await send(client, cookie, attack)).status(), [404], 'B')
    }
    for (const attack of listAttacks(b.s.id)) {
      assertDenied(assert, attack, (await send(client, cookie, attack)).status(), [404], 'B')
    }
    ;(await authed(client, 'get', `${base(a.s.id)}/${idsA.pending}`, cookie)).assertStatus(200)
    assert.equal(await snapshot(b.s.id), beforeB)
  })
})

test.group('Isolamento de pedidos | exclusão e administração da plataforma', (group) => {
  group.each.setup(resetState)

  test('não existe rota que exclua pedidos e o DELETE do próprio dono também é negado', async ({
    client,
    assert,
  }) => {
    const routes = Object.values(router.toJSON()).flat()
    const deleting = routes
      .filter((route) => route.methods.includes('DELETE') && /orders/.test(route.pattern))
      .map((route) => route.pattern)
    assert.deepEqual(deleting, [])

    const a = await createTenant()
    const ids = await seedOrders(client, a)
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const before = await snapshot(a.s.id)

    for (const id of Object.values(ids)) {
      const response = await authed(client, 'delete', `${base(a.s.id)}/${id}`, cookie)
      assert.include([404, 405], response.status(), `DELETE do próprio pedido ${id}`)
    }
    assert.equal(await snapshot(a.s.id), before)
  })

  test('o platform_admin não tem rota de pedidos e o painel o recusa', async ({
    client,
    assert,
  }) => {
    const b = await createTenant()
    const ids = await seedOrders(client, b)
    const admin = await createUser({ isPlatformAdmin: true })
    const cookie = await loginAndGetCookie(client, admin.email)
    const before = await snapshot(b.s.id)

    const orderRoutes = Object.values(router.toJSON())
      .flat()
      .filter((route) => /\/platform\//.test(route.pattern) && /orders/.test(route.pattern))
    assert.lengthOf(orderRoutes, 0)

    for (const method of ['get', 'patch', 'delete'] as const) {
      for (const url of [
        '/api/v1/platform/orders',
        `/api/v1/platform/orders/${ids.pending}`,
        `/api/v1/platform/restaurants/${b.s.id}/orders`,
        `/api/v1/platform/restaurants/${b.s.id}/orders/${ids.pending}`,
      ]) {
        const response = await authed(client, method, url, cookie).json({ status: 'confirmed' })
        assert.include([404, 405], response.status(), `${method} ${url}`)
      }
    }
    assert.equal(await snapshot(b.s.id), before)
  })
})
