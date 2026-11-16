import { randomBytes, randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import router from '@adonisjs/core/services/router'
import {
  authed,
  createRestaurantWithTeam,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'
import { counts, insertId, nextNumber } from '#tests/order_helpers'
import { canTransition } from '#support/order_status'
import { ORDER_STATUSES } from '#validators/order'

// F5-T7: PATCH /tenant/:restaurantId/orders/:id/status (owner e staff).

const NAME = 'Zé Segredo da Silva'
const PHONE = '11987654321'
const NOTES = 'observação-confidencial-123'

const statusUrl = (restaurantId: string, id: string) =>
  `/api/v1/tenant/${restaurantId}/orders/${id}/status`

type Team = Awaited<ReturnType<typeof createRestaurantWithTeam>>

let sequence = 0
async function insertOrder(restaurantId: string, status = 'pending'): Promise<string> {
  sequence += 1
  return insertId('orders', {
    restaurant_id: restaurantId,
    order_number: 2000 + sequence,
    customer_name: NAME,
    customer_phone: PHONE,
    notes: NOTES,
    fulfillment_type: 'pickup',
    payment_method: 'cash',
    status,
    total: '10.00',
    tracking_token: randomBytes(32).toString('base64url'),
    idempotency_key: randomUUID(),
    idempotency_hash: 'hash',
  })
}

const historyOf = (orderId: string) =>
  db.from('order_status_history').where('order_id', orderId).orderBy('created_at').select()

const statusOf = async (orderId: string) =>
  (await db.from('orders').where('id', orderId).first()).status as string

async function owner(client: unknown, team: Team) {
  return loginAndGetCookie(client as any, team.owner.email)
}

const patch = (client: unknown, team: Team, id: string, cookie: string, body: unknown) =>
  authed(client as any, 'patch', statusUrl(team.restaurant.id, id), cookie).json(body as object)

const VALID: [string, string][] = [
  ['pending', 'confirmed'],
  ['confirmed', 'preparing'],
  ['preparing', 'ready'],
  ['ready', 'completed'],
  ['pending', 'cancelled'],
  ['confirmed', 'cancelled'],
  ['preparing', 'cancelled'],
]

test.group('PATCH /orders/:id/status | transições', (group) => {
  group.each.setup(resetState)

  test('a tabela tem exatamente as 7 transições do ROADMAP 5.3', async ({ assert }) => {
    const allowed: string[] = []
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) if (canTransition(from, to)) allowed.push(`${from}>${to}`)
    }
    assert.sameMembers(
      allowed,
      VALID.map(([from, to]) => `${from}>${to}`)
    )
  })

  test('fluxo completo pending → completed, com histórico e updated_at a cada passo', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const cookie = await owner(client, team)
    let lastUpdate = (await db.from('orders').where('id', id).first()).updated_at as Date

    for (const status of ['confirmed', 'preparing', 'ready', 'completed']) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      const response = await patch(client, team, id, cookie, { status })
      response.assertStatus(200)
      const { data } = response.body()
      assert.deepEqual(Object.keys(data).sort(), ['id', 'order_number', 'status', 'updated_at'])
      assert.equal(data.id, id)
      assert.equal(data.status, status)
      assert.isAbove(new Date(data.updated_at).getTime(), lastUpdate.getTime())
      lastUpdate = new Date(data.updated_at)
    }

    const history = await historyOf(id)
    assert.deepEqual(
      history.map((row) => [row.previous_status, row.new_status]),
      [
        ['pending', 'confirmed'],
        ['confirmed', 'preparing'],
        ['preparing', 'ready'],
        ['ready', 'completed'],
      ]
    )
    for (const row of history) {
      assert.equal(row.changed_by_user_id, team.owner.id)
      assert.equal(row.restaurant_id, team.restaurant.id)
    }
    assert.equal(await statusOf(id), 'completed')
  })

  test('matriz 6×6: só as 7 transições valem; as demais respondem 409 sem alterar nada', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const cookie = await owner(client, team)
    let accepted = 0
    let rejected = 0

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const id = await insertOrder(team.restaurant.id, from)
        const response = await patch(client, team, id, cookie, { status: to })
        const label = `${from} → ${to}`
        if (VALID.some(([a, b]) => a === from && b === to)) {
          response.assertStatus(200)
          assert.equal(await statusOf(id), to, label)
          assert.lengthOf(await historyOf(id), 1, label)
          accepted += 1
        } else {
          response.assertStatus(409)
          assert.equal(response.body().code, 'INVALID_TRANSITION', label)
          assert.deepEqual(Object.keys(response.body()).sort(), ['code', 'message'])
          assert.equal(await statusOf(id), from, label)
          assert.lengthOf(await historyOf(id), 0, label)
          rejected += 1
        }
      }
    }
    assert.equal(accepted, 7)
    assert.equal(rejected, 29)
  })

  test('cancelamento: aceito em pending, confirmed e preparing; recusado em ready e nos finais', async ({
    client,
  }) => {
    const team = await createRestaurantWithTeam()
    const cookie = await owner(client, team)
    for (const from of ['pending', 'confirmed', 'preparing']) {
      const id = await insertOrder(team.restaurant.id, from)
      ;(await patch(client, team, id, cookie, { status: 'cancelled' })).assertStatus(200)
    }
    for (const from of ['ready', 'completed', 'cancelled']) {
      const id = await insertOrder(team.restaurant.id, from)
      ;(await patch(client, team, id, cookie, { status: 'cancelled' })).assertStatus(409)
    }
  })

  test('staff também altera o status, e o histórico registra quem foi', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const cookie = await loginAndGetCookie(client, team.staff.email)
    ;(await patch(client, team, id, cookie, { status: 'confirmed' })).assertStatus(200)
    const [row] = await historyOf(id)
    assert.equal(row.changed_by_user_id, team.staff.id)
  })

  test('o acompanhamento público mostra o novo status', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const token = (await db.from('orders').where('id', id).first()).tracking_token
    const cookie = await owner(client, team)
    ;(await patch(client, team, id, cookie, { status: 'confirmed' })).assertStatus(200)
    const tracking = await client.get(`/api/v1/public/orders/${token}`)
    tracking.assertStatus(200)
    assert.equal(tracking.body().data.status, 'confirmed')
  })
})

test.group('PATCH /orders/:id/status | entrada', (group) => {
  group.each.setup(resetState)

  test('corpo inválido responde 422 e não altera o pedido', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const cookie = await owner(client, team)
    for (const body of [
      {},
      { status: '' },
      { status: 'entregue' },
      { status: 'CONFIRMED' },
      { status: 1 },
      { status: null },
      { status: ['confirmed'] },
      { status: 'confirmed', total: '0.01' },
      { status: 'confirmed', restaurant_id: randomUUID() },
      { status: 'confirmed', customer_name: 'x' },
    ]) {
      const response = await patch(client, team, id, cookie, body)
      response.assertStatus(422)
    }
    assert.equal(await statusOf(id), 'pending')
    assert.lengthOf(await historyOf(id), 0)
  })

  test('id inexistente ou malformado responde 404 uniforme', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const cookie = await owner(client, team)
    const bodies = new Set<string>()
    for (const id of [randomUUID(), 'abc', '123']) {
      const response = await patch(client, team, id, cookie, { status: 'confirmed' })
      response.assertStatus(404)
      bodies.add(JSON.stringify(response.body()))
    }
    assert.equal(bodies.size, 1)
  })
})

test.group('PATCH /orders/:id/status | autorização e isolamento A × B', (group) => {
  group.each.setup(resetState)

  test('sem sessão: 401; sem Origin válido: 403', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const url = statusUrl(team.restaurant.id, id)
    ;(
      await client
        .patch(url)
        .header('Origin', 'http://localhost:3000')
        .json({ status: 'confirmed' })
    ).assertStatus(401)

    const cookie = await owner(client, team)
    const noOrigin = await client.patch(url).header('Cookie', cookie).json({ status: 'confirmed' })
    noOrigin.assertStatus(403)
    const badOrigin = await client
      .patch(url)
      .header('Cookie', cookie)
      .header('Origin', 'https://outro.exemplo.com')
      .json({ status: 'confirmed' })
    badOrigin.assertStatus(403)
    assert.equal(await statusOf(id), 'pending')
  })

  test('platform_admin sem vínculo, vínculo inativo e senha pendente são recusados', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)

    const admin = await createUser({ isPlatformAdmin: true })
    const adminCookie = await loginAndGetCookie(client, admin.email)
    ;(await patch(client, team, id, adminCookie, { status: 'confirmed' })).assertStatus(404)

    const former = await createUser()
    await link(former, team.restaurant, 'staff', false)
    await link(former, (await createRestaurantWithTeam()).restaurant, 'staff')
    const formerCookie = await loginAndGetCookie(client, former.email)
    ;(await patch(client, team, id, formerCookie, { status: 'confirmed' })).assertStatus(404)

    const temporary = await createUser({ mustChangePassword: true })
    await link(temporary, team.restaurant, 'staff')
    const temporaryCookie = await loginAndGetCookie(client, temporary.email)
    const blocked = await patch(client, team, id, temporaryCookie, { status: 'confirmed' })
    blocked.assertStatus(403)
    blocked.assertBodyContains({ code: 'PASSWORD_CHANGE_REQUIRED' })

    assert.equal(await statusOf(id), 'pending')
    assert.lengthOf(await historyOf(id), 0)
  })

  test('alteração: usuário do restaurante A não altera pedido do B, mesmo com o id', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const orderB = await insertOrder(b.restaurant.id)
    const cookie = await owner(client, a)

    // restaurante B na URL: sem vínculo
    ;(await patch(client, b, orderB, cookie, { status: 'confirmed' })).assertStatus(404)
    // id do pedido do B sob o restaurante A: o filtro por restaurante não o encontra
    ;(await patch(client, a, orderB, cookie, { status: 'confirmed' })).assertStatus(404)

    assert.equal(await statusOf(orderB), 'pending')
    assert.lengthOf(await historyOf(orderB), 0)
  })

  test('não existe rota pública que altere ou cancele pedidos', async ({ client, assert }) => {
    const routes = Object.values(router.toJSON()).flat()
    const publicRoutes = routes.filter((route) => route.pattern.includes('/public/'))
    assert.isAbove(publicRoutes.length, 0)
    const writes = publicRoutes
      .flatMap((route) => route.methods.map((method) => `${method} ${route.pattern}`))
      .filter((entry) => !entry.startsWith('GET ') && !entry.startsWith('HEAD '))
      .sort()
    assert.deepEqual(writes, [
      'POST /api/v1/public/restaurants/:slug/cart/quote',
      'POST /api/v1/public/restaurants/:slug/orders',
    ])

    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const token = (await db.from('orders').where('id', id).first()).tracking_token
    for (const path of [
      `/api/v1/public/orders/${token}`,
      `/api/v1/public/orders/${token}/status`,
    ]) {
      for (const method of ['patch', 'put', 'delete', 'post'] as const) {
        const response = await client[method](path).json({ status: 'cancelled' })
        assert.include([404, 405], response.status(), `${method} ${path}`)
      }
    }
    assert.equal(await statusOf(id), 'pending')
  })
})

test.group('PATCH /orders/:id/status | atomicidade e concorrência', (group) => {
  group.each.setup(resetState)

  test('falha ao gravar o histórico desfaz a alteração do status (rollback real)', async ({
    client,
    assert,
    cleanup,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const cookie = await owner(client, team)

    // O INSERT no histórico falha dentro da transação, depois do UPDATE em orders
    await db.rawQuery(
      `create function test_fail_history() returns trigger language plpgsql as
         $$ begin raise exception 'falha simulada'; end $$`
    )
    await db.rawQuery(
      `create trigger test_fail_history before insert on order_status_history
         for each row execute function test_fail_history()`
    )
    cleanup(async () => {
      await db.rawQuery('drop trigger if exists test_fail_history on order_status_history')
      await db.rawQuery('drop function if exists test_fail_history()')
    })

    const response = await patch(client, team, id, cookie, { status: 'confirmed' })
    response.assertStatus(500)
    assert.equal(await statusOf(id), 'pending')
    assert.lengthOf(await historyOf(id), 0)
  })

  test('duas alterações simultâneas se serializam: uma vence, a outra recebe 409', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const cookie = await owner(client, team)

    const waiting = async () => {
      const result = await db.rawQuery(
        `select count(*)::int as n from pg_stat_activity
          where wait_event_type = 'Lock' and datname = current_database()
            and query ilike '%from "orders"%for update%'`
      )
      return result.rows[0].n as number
    }

    // Segura a linha do pedido: as duas requisições esperam no FOR UPDATE
    const blocker = await db.transaction()
    await blocker.rawQuery('select id from orders where id = ? for update', [id])

    const settled = { a: false, b: false }
    const requestA = patch(client, team, id, cookie, { status: 'confirmed' }).finally(() => {
      settled.a = true
    })
    const requestB = patch(client, team, id, cookie, { status: 'confirmed' }).finally(() => {
      settled.b = true
    })
    let maxWaiting = 0
    try {
      for (let i = 0; i < 100 && maxWaiting < 2 && !(settled.a || settled.b); i++) {
        maxWaiting = Math.max(maxWaiting, await waiting())
        if (maxWaiting < 2) await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } finally {
      await blocker.commit()
    }
    const responses = await Promise.all([requestA, requestB])

    assert.equal(maxWaiting, 2, 'as duas requisições deveriam esperar o FOR UPDATE')
    assert.sameMembers(responses.map((response) => response.status()).sort(), [200, 409])
    assert.equal(await statusOf(id), 'confirmed')
    assert.lengthOf(await historyOf(id), 1)
  })

  test('pedidos de um restaurante não bloqueiam os de outro', async ({ client, assert }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const orderA = await insertOrder(a.restaurant.id)
    const orderB = await insertOrder(b.restaurant.id)
    const [cookieA, cookieB] = [await owner(client, a), await owner(client, b)]
    const responses = await Promise.all([
      patch(client, a, orderA, cookieA, { status: 'confirmed' }),
      patch(client, b, orderB, cookieB, { status: 'confirmed' }),
    ])
    for (const response of responses) response.assertStatus(200)
    assert.lengthOf(await historyOf(orderA), 1)
    assert.lengthOf(await historyOf(orderB), 1)
  })
})

test.group('PATCH /orders/:id/status | auditoria e efeitos colaterais', (group) => {
  group.each.setup(resetState)

  test('auditoria só com ator, ação e recurso, depois do commit, sem dados pessoais', async ({
    client,
    assert,
  }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const token = (await db.from('orders').where('id', id).first()).tracking_token as string
    const cookie = await owner(client, team)

    const captured: unknown[][] = []
    const original = logger.info
    logger.info = ((...args: unknown[]) => {
      captured.push(args)
    }) as typeof logger.info
    try {
      ;(await patch(client, team, id, cookie, { status: 'confirmed' })).assertStatus(200)
      // transição inválida: não gera auditoria
      ;(await patch(client, team, id, cookie, { status: 'pending' })).assertStatus(409)
    } finally {
      logger.info = original
    }

    const audits = captured.filter(([data]) => (data as { audit?: boolean })?.audit === true)
    assert.lengthOf(audits, 1)
    assert.deepEqual(audits[0][0], {
      audit: true,
      actor_id: team.owner.id,
      action: 'order.status_changed',
      resource_type: 'order',
      resource_id: id,
    })
    const text = JSON.stringify(captured)
    for (const secret of [NAME, PHONE, NOTES, token, 'confirmed']) {
      assert.notInclude(text, secret, `vazou: ${secret}`)
    }
  })

  test('não mexe em itens, total, numeração nem em outros pedidos', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const other = await insertOrder(team.restaurant.id)
    const id = await insertOrder(team.restaurant.id)
    const before = await counts()
    const next = await nextNumber(team.restaurant.id)
    const totalBefore = (await db.from('orders').where('id', id).first()).total
    const cookie = await owner(client, team)

    ;(await patch(client, team, id, cookie, { status: 'confirmed' })).assertStatus(200)

    const after = await counts()
    assert.deepEqual({ ...after, history: 0 }, { ...before, history: 0 })
    assert.equal(after.history, before.history + 1)
    assert.equal(await nextNumber(team.restaurant.id), next)
    assert.equal((await db.from('orders').where('id', id).first()).total, totalBefore)
    assert.equal(await statusOf(other), 'pending')
  })

  test('o detalhe do painel reflete o novo status e o histórico', async ({ client, assert }) => {
    const team = await createRestaurantWithTeam()
    const id = await insertOrder(team.restaurant.id)
    const cookie = await owner(client, team)
    ;(await patch(client, team, id, cookie, { status: 'confirmed' })).assertStatus(200)
    const detail = await authed(
      client,
      'get',
      `/api/v1/tenant/${team.restaurant.id}/orders/${id}`,
      cookie
    )
    detail.assertStatus(200)
    assert.equal(detail.body().data.status, 'confirmed')
    assert.deepEqual(
      detail.body().data.history.map((row: { new_status: string }) => row.new_status),
      ['confirmed']
    )
  })
})
