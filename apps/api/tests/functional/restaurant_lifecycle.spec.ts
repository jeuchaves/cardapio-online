import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { http as httpConfig } from '#config/app'
import sessionConfig from '#config/session'
import Restaurant from '#models/restaurant'
import {
  authed,
  createRestaurantWithTeam,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'
import { newKey, orderBody, postOrder, setup } from '#tests/order_helpers'

// F6-T1: ROADMAP 5.1 (restaurante inativo) e CLAUDE.md seções 5 e 6.

test.group('Restaurante inativo | pedidos já existentes', (group) => {
  group.each.setup(resetState)

  test('o painel continua listando, detalhando e atualizando; o público para de receber pedidos', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const restaurant = await Restaurant.findOrFail(s.id)
    const owner = await createUser()
    const staff = await createUser()
    await link(owner, restaurant, 'owner')
    await link(staff, restaurant, 'staff')

    const created = await postOrder(client, s, newKey(), orderBody(s))
    created.assertStatus(201)
    const token = created.body().data.tracking_token as string
    const order = await db.from('orders').where('restaurant_id', s.id).first()

    const admin = await createUser({ isPlatformAdmin: true })
    const adminCookie = await loginAndGetCookie(client, admin.email)
    ;(
      await authed(
        client,
        'patch',
        `/api/v1/platform/restaurants/${s.id}/status`,
        adminCookie
      ).json({
        is_active: false,
      })
    ).assertStatus(200)

    // Público: cardápio fora do ar e nenhum pedido novo
    ;(await client.get(`/api/v1/public/restaurants/${s.slug}`)).assertStatus(404)
    const blocked = await postOrder(client, s, newKey(), orderBody(s))
    blocked.assertStatus(404)
    assert.equal(
      await db
        .from('orders')
        .where('restaurant_id', s.id)
        .count('* as n')
        .first()
        .then((r) => Number(r.n)),
      1
    )

    // O cliente ainda acompanha o pedido que já fez
    ;(await client.get(`/api/v1/public/orders/${token}`)).assertStatus(200)

    // Painel: owner e staff continuam operando o pedido existente
    const base = `/api/v1/tenant/${s.id}`
    for (const user of [owner, staff]) {
      const cookie = await loginAndGetCookie(client, user.email)
      const list = await authed(client, 'get', `${base}/orders`, cookie)
      list.assertStatus(200)
      assert.lengthOf(list.body().data, 1)
      ;(await authed(client, 'get', `${base}/orders/${order.id}`, cookie)).assertStatus(200)
    }
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const moved = await authed(
      client,
      'patch',
      `${base}/orders/${order.id}/status`,
      ownerCookie
    ).json({
      status: 'confirmed',
    })
    moved.assertStatus(200)
    assert.equal((await db.from('orders').where('id', order.id).first()).status, 'confirmed')

    // E o acompanhamento público reflete a mudança
    const tracked = await client.get(`/api/v1/public/orders/${token}`)
    tracked.assertStatus(200)
    assert.equal(tracked.body().data.status, 'confirmed')
  })
})

test.group('Exclusão | restaurante e equipe não têm rota de remoção', (group) => {
  group.each.setup(resetState)

  test('DELETE e PUT não existem para restaurante e equipe; nada é removido', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const admin = await createUser({ isPlatformAdmin: true })
    const adminCookie = await loginAndGetCookie(client, admin.email)
    const ownerCookie = await loginAndGetCookie(client, a.owner.email)

    const snapshot = async () => ({
      restaurants: Number((await db.from('restaurants').count('* as n').first()).n),
      links: Number((await db.from('restaurant_users').count('* as n').first()).n),
      users: Number((await db.from('users').count('* as n').first()).n),
    })
    const before = await snapshot()

    const attempts: Array<[string, 'delete' | 'put', string, string]> = [
      [
        'admin remove restaurante',
        'delete',
        `/api/v1/platform/restaurants/${a.restaurant.id}`,
        adminCookie,
      ],
      [
        'owner remove o próprio restaurante',
        'delete',
        `/api/v1/tenant/${a.restaurant.id}/restaurant`,
        ownerCookie,
      ],
      [
        'owner remove restaurante de B',
        'delete',
        `/api/v1/tenant/${b.restaurant.id}/restaurant`,
        ownerCookie,
      ],
      [
        'owner remove o próprio staff',
        'delete',
        `/api/v1/tenant/${a.restaurant.id}/staff/${a.staff.id}`,
        ownerCookie,
      ],
      [
        'owner remove staff de B',
        'delete',
        `/api/v1/tenant/${b.restaurant.id}/staff/${b.staff.id}`,
        ownerCookie,
      ],
      [
        'owner substitui restaurante',
        'put',
        `/api/v1/tenant/${a.restaurant.id}/restaurant`,
        ownerCookie,
      ],
      [
        'admin substitui restaurante',
        'put',
        `/api/v1/platform/restaurants/${a.restaurant.id}`,
        adminCookie,
      ],
    ]
    for (const [label, method, url, cookie] of attempts) {
      const response = await authed(client, method, url, cookie)
      assert.oneOf(response.status(), [404, 405], label)
    }
    assert.deepEqual(await snapshot(), before)
  })
})

test.group('Cookie de sessão | atributos de produção', () => {
  // O Secure só aparece com NODE_ENV=production (testes rodam fora dele). Enquanto isso, o teste
  // garante que a config segue o ambiente e não ficou fixa em false; em homologação (F6-T4) o
  // Set-Cookie real atrás do HTTPS é conferido.
  test('Secure acompanha app.inProduction; HttpOnly, SameSite=Lax e sem Domain fixos', async ({
    assert,
  }) => {
    const session = await configProvider.resolve<{ cookie: Record<string, unknown> }>(
      app,
      sessionConfig
    )
    const cookie = session!.cookie
    assert.equal(cookie.secure, app.inProduction)
    assert.isTrue(cookie.httpOnly)
    assert.equal(cookie.sameSite, 'lax')
    assert.equal(cookie.path, '/')
    assert.notProperty(cookie, 'domain')

    const http = (httpConfig as { cookie: Record<string, unknown> }).cookie
    assert.equal(http.secure, app.inProduction)
    assert.isTrue(http.httpOnly)
    assert.equal(http.sameSite, 'lax')
  })
})
