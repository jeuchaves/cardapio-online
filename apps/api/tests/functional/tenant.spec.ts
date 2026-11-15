import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import RestaurantUser from '#models/restaurant_user'
import User from '#models/user'
import {
  PASSWORD,
  authed,
  createRestaurant,
  createRestaurantWithTeam,
  createUser,
  link,
  loginAndGetCookie,
  loginRequest,
  resetState,
} from '#tests/helpers'

const base = (restaurantId: string) => `/api/v1/tenant/${restaurantId}`

test.group('Tenant | acesso pelo vínculo', (group) => {
  group.each.setup(resetState)

  test('sem vínculo, vínculo inativo e id malformado respondem 404', async ({ client }) => {
    const { restaurant } = await createRestaurantWithTeam()
    const outsider = await createUser()
    const inactive = await createUser()
    await link(inactive, restaurant, 'owner', false)

    for (const user of [outsider, inactive]) {
      const cookie = await loginAndGetCookie(client, user.email).catch(() => null)
      // Sem vínculo ativo o login também é recusado (D6): o 404 vale para sessões já abertas
      if (cookie) {
        ;(await authed(client, 'get', `${base(restaurant.id)}/restaurant`, cookie)).assertStatus(
          404
        )
      }
    }

    const owner = await createUser()
    await link(owner, restaurant, 'owner')
    const cookie = await loginAndGetCookie(client, owner.email)
    ;(await authed(client, 'get', `${base('nao-e-uuid')}/restaurant`, cookie)).assertStatus(404)
    ;(
      await authed(
        client,
        'get',
        `${base('00000000-0000-4000-8000-000000000000')}/restaurant`,
        cookie
      )
    ).assertStatus(404)
  })

  test('9: vínculo desativado nega o acesso na requisição seguinte, com a sessão ainda válida', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff } = await createRestaurantWithTeam()
    const other = await createRestaurant()
    await link(staff, other, 'staff')
    const staffCookie = await loginAndGetCookie(client, staff.email)
    ;(await authed(client, 'get', `${base(restaurant.id)}/restaurant`, staffCookie)).assertStatus(
      200
    )

    // Desativa o vínculo diretamente no banco: a sessão continua existindo
    await db
      .from('restaurant_users')
      .where({ restaurant_id: restaurant.id, user_id: staff.id })
      .update({ is_active: false })
    assert.lengthOf(await db.from('sessions').where('user_id', staff.id), 1)

    ;(await authed(client, 'get', `${base(restaurant.id)}/restaurant`, staffCookie)).assertStatus(
      404
    )
    // O outro vínculo ativo segue funcionando
    ;(await authed(client, 'get', `${base(other.id)}/restaurant`, staffCookie)).assertStatus(200)
    assert.exists(owner)
  })

  test('usuário com vínculo em dois restaurantes acessa só o informado e autorizado', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurant({ name: 'A' })
    const b = await createRestaurant({ name: 'B' })
    const c = await createRestaurant({ name: 'C' })
    const user = await createUser()
    await link(user, a, 'owner')
    await link(user, b, 'staff')
    const cookie = await loginAndGetCookie(client, user.email)

    const ra = await authed(client, 'get', `${base(a.id)}/restaurant`, cookie)
    assert.equal(ra.body().data.name, 'A')
    const rb = await authed(client, 'get', `${base(b.id)}/restaurant`, cookie)
    assert.equal(rb.body().data.name, 'B')
    // Papel por restaurante: owner em A, staff em B
    ;(
      await authed(client, 'patch', `${base(a.id)}/restaurant`, cookie).json({ name: 'A2' })
    ).assertStatus(200)
    ;(
      await authed(client, 'patch', `${base(b.id)}/restaurant`, cookie).json({ name: 'B2' })
    ).assertStatus(403)
    ;(await authed(client, 'get', `${base(c.id)}/restaurant`, cookie)).assertStatus(404)
    assert.equal((await db.from('restaurants').where('id', b.id).first()).name, 'B')
  })

  test('platform_admin e owner não cruzam as áreas', async ({ client }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const admin = await createUser({ isPlatformAdmin: true })
    const adminCookie = await loginAndGetCookie(client, admin.email)
    const ownerCookie = await loginAndGetCookie(client, owner.email)

    ;(await authed(client, 'get', `${base(restaurant.id)}/restaurant`, adminCookie)).assertStatus(
      404
    )
    ;(await authed(client, 'get', `${base(restaurant.id)}/staff`, adminCookie)).assertStatus(404)
    ;(await authed(client, 'get', '/api/v1/platform/restaurants', ownerCookie)).assertStatus(403)
  })

  test('staff lê o restaurante mas não escreve nem gerencia equipe', async ({ client }) => {
    const { restaurant, staff } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, staff.email)
    const url = base(restaurant.id)

    ;(await authed(client, 'get', `${url}/restaurant`, cookie)).assertStatus(200)
    ;(await authed(client, 'patch', `${url}/restaurant`, cookie).json({ name: 'X' })).assertStatus(
      403
    )
    ;(
      await authed(client, 'patch', `${url}/restaurant/settings`, cookie).json({
        accepts_pix: false,
      })
    ).assertStatus(403)
    ;(await authed(client, 'get', `${url}/staff`, cookie)).assertStatus(403)
    ;(
      await authed(client, 'post', `${url}/staff`, cookie).json({
        name: 'N',
        email: 'n@exemplo.com',
      })
    ).assertStatus(403)
    ;(
      await authed(client, 'patch', `${url}/staff/${staff.id}`, cookie).json({ is_active: false })
    ).assertStatus(403)
    ;(await authed(client, 'post', `${url}/staff/${staff.id}/reset-password`, cookie)).assertStatus(
      403
    )
  })
})

test.group('Tenant | dados e configurações', (group) => {
  group.each.setup(resetState)

  test('owner edita nome, descrição e telefone; slug e is_active são rejeitados', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = `${base(restaurant.id)}/restaurant`

    const response = await authed(client, 'patch', url, cookie).json({
      name: 'Novo Nome',
      description: 'Descrição',
      phone: '(11) 3333-4444',
    })
    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Novo Nome')

    for (const body of [
      { slug: 'outro' },
      { is_active: false },
      { name: '' },
      { name: 'x'.repeat(121) },
    ]) {
      ;(await authed(client, 'patch', url, cookie).json(body)).assertStatus(422)
    }
    const row = await db.from('restaurants').where('id', restaurant.id).first()
    assert.equal(row.slug, restaurant.slug)
    assert.isTrue(row.is_active)
  })

  test('configurações: exige ao menos uma modalidade e um método de pagamento', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = `${base(restaurant.id)}/restaurant/settings`

    const ok = await authed(client, 'patch', url, cookie).json({
      accepts_dine_in: false,
      accepts_card: false,
    })
    ok.assertStatus(200)
    assert.isFalse(ok.body().data.accepts_dine_in)
    assert.isTrue(ok.body().data.accepts_pickup)

    // Desabilitaria todas as modalidades / todos os métodos
    ;(await authed(client, 'patch', url, cookie).json({ accepts_pickup: false })).assertStatus(422)
    ;(
      await authed(client, 'patch', url, cookie).json({ accepts_cash: false, accepts_pix: false })
    ).assertStatus(422)
    ;(await authed(client, 'patch', url, cookie).json({ accepts_pix: 'sim' })).assertStatus(422)
    ;(await authed(client, 'patch', url, cookie).json({ is_active: false })).assertStatus(422)

    const row = await db.from('restaurants').where('id', restaurant.id).first()
    assert.isTrue(row.accepts_pickup)
    assert.isTrue(row.accepts_cash)
    assert.isTrue(row.accepts_pix)
  })
})

test.group('Tenant | equipe (staff)', (group) => {
  group.each.setup(resetState)

  test('cria staff com senha temporária única, que obriga a troca no primeiro acesso', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = `${base(restaurant.id)}/staff`

    const response = await authed(client, 'post', url, cookie).json({
      name: 'Novo Atendente',
      email: 'Atendente@Exemplo.com',
    })
    response.assertStatus(201)
    assert.equal(response.header('cache-control'), 'no-store')
    const created = response.body().data
    assert.equal(created.role, 'staff')
    assert.equal(created.email, 'atendente@exemplo.com')
    assert.lengthOf(created.temporary_password, 16)

    const user = await User.findOrFail(created.id)
    assert.isTrue(user.mustChangePassword)
    assert.notEqual(user.password, created.temporary_password)

    ;(
      await authed(client, 'post', url, cookie).json({
        name: 'Outro',
        email: 'atendente@exemplo.com',
      })
    ).assertStatus(409)

    const login = await loginRequest(client, 'atendente@exemplo.com', created.temporary_password)
    login.assertStatus(200)
    login.assertBodyContains({ data: { user: { must_change_password: true } } })

    // A listagem não expõe senha nem hash nem a senha temporária
    const list = await authed(client, 'get', url, cookie)
    list.assertStatus(200)
    const text = JSON.stringify(list.body())
    assert.notInclude(text, created.temporary_password)
    assert.notInclude(text, user.password)
    assert.notInclude(text, 'password')
    assert.lengthOf(list.body().data, 3)
  })

  test('desativar staff nega o acesso e derruba as sessões; reativar restaura o vínculo', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff } = await createRestaurantWithTeam()
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const staffCookie = await loginAndGetCookie(client, staff.email)
    const url = `${base(restaurant.id)}/staff/${staff.id}`

    const off = await authed(client, 'patch', url, ownerCookie).json({ is_active: false })
    off.assertStatus(200)
    ;(await authed(client, 'get', '/api/v1/auth/me', staffCookie)).assertStatus(401)
    assert.lengthOf(await db.from('sessions').where('user_id', staff.id), 0)
    // Sem vínculo ativo, o login também é recusado
    ;(await loginRequest(client, staff.email)).assertStatus(401)

    ;(await authed(client, 'patch', url, ownerCookie).json({ is_active: true })).assertStatus(200)
    ;(await loginRequest(client, staff.email)).assertStatus(200)
  })

  test('D8: owner não altera o próprio vínculo nem o de outro owner pela equipe', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const secondOwner = await createUser()
    await link(secondOwner, restaurant, 'owner')
    const cookie = await loginAndGetCookie(client, owner.email)

    for (const target of [owner, secondOwner]) {
      const url = `${base(restaurant.id)}/staff/${target.id}`
      ;(await authed(client, 'patch', url, cookie).json({ is_active: false })).assertStatus(403)
      ;(await authed(client, 'post', `${url}/reset-password`, cookie)).assertStatus(403)
    }
    const links = await RestaurantUser.query().where('role', 'owner')
    assert.isTrue(links.every((item) => item.isActive))
    ;(await authed(client, 'get', '/api/v1/auth/me', cookie)).assertStatus(200)
  })

  test('reset de senha do staff: nova senha temporária e sessões revogadas', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff } = await createRestaurantWithTeam()
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const staffCookie = await loginAndGetCookie(client, staff.email)

    const response = await authed(
      client,
      'post',
      `${base(restaurant.id)}/staff/${staff.id}/reset-password`,
      ownerCookie
    )
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'no-store')
    const temporary = response.body().data.temporary_password

    ;(await authed(client, 'get', '/api/v1/auth/me', staffCookie)).assertStatus(401)
    ;(await loginRequest(client, staff.email, PASSWORD)).assertStatus(401)
    ;(await loginRequest(client, staff.email, temporary)).assertStatus(200)
    const after = await User.findOrFail(staff.id)
    assert.isTrue(after.mustChangePassword)
    assert.isTrue(await hash.verify(after.password, temporary))
  })

  test('o owner não redefine senha de usuário que pertence a outro restaurante ou à plataforma', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff } = await createRestaurantWithTeam()
    const elsewhere = await createRestaurant()
    // O mesmo usuário é staff aqui e owner em outro restaurante
    await link(staff, elsewhere, 'owner')
    const cookie = await loginAndGetCookie(client, owner.email)
    const passwordBefore = staff.password

    ;(
      await authed(
        client,
        'post',
        `${base(restaurant.id)}/staff/${staff.id}/reset-password`,
        cookie
      )
    ).assertStatus(403)
    assert.equal((await User.findOrFail(staff.id)).password, passwordBefore)
  })
})

test.group('Isolamento | restaurante A não alcança o restaurante B', (group) => {
  group.each.setup(resetState)

  test('leitura, alteração e ações de equipe com o id do restaurante B: 404 sem alterar dados', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const target = base(b.restaurant.id)

    const snapshot = async () =>
      JSON.stringify({
        restaurants: await db.from('restaurants').orderBy('id'),
        links: await db.from('restaurant_users').orderBy('id'),
        users: await db.from('users').orderBy('id'),
      })
    const before = await snapshot()

    const requests = [
      authed(client, 'get', `${target}/restaurant`, cookie),
      authed(client, 'patch', `${target}/restaurant`, cookie).json({ name: 'Invadido' }),
      authed(client, 'patch', `${target}/restaurant/settings`, cookie).json({ accepts_pix: false }),
      authed(client, 'get', `${target}/staff`, cookie),
      authed(client, 'post', `${target}/staff`, cookie).json({ name: 'N', email: 'n@exemplo.com' }),
      authed(client, 'patch', `${target}/staff/${b.staff.id}`, cookie).json({ is_active: false }),
      authed(client, 'post', `${target}/staff/${b.staff.id}/reset-password`, cookie),
    ]
    for (const request of requests) {
      ;(await request).assertStatus(404)
    }
    assert.equal(await snapshot(), before)
  })

  test('userId de B pelo caminho de A: 404 sem alterar dados do outro restaurante', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const passwordBefore = (await User.findOrFail(b.staff.id)).password

    const update = await authed(
      client,
      'patch',
      `${base(a.restaurant.id)}/staff/${b.staff.id}`,
      cookie
    ).json({ is_active: false })
    update.assertStatus(404)
    ;(
      await authed(
        client,
        'post',
        `${base(a.restaurant.id)}/staff/${b.staff.id}/reset-password`,
        cookie
      )
    ).assertStatus(404)

    const membership = await RestaurantUser.query()
      .where({ restaurantId: b.restaurant.id, userId: b.staff.id })
      .firstOrFail()
    assert.isTrue(membership.isActive)
    assert.equal((await User.findOrFail(b.staff.id)).password, passwordBefore)
    assert.lengthOf(await db.from('sessions').where('user_id', a.owner.id), 1)
  })

  test('staff de A também não alcança B', async ({ client }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, a.staff.email)
    ;(await authed(client, 'get', `${base(b.restaurant.id)}/restaurant`, cookie)).assertStatus(404)
    ;(
      await authed(client, 'patch', `${base(b.restaurant.id)}/restaurant`, cookie).json({
        name: 'X',
      })
    ).assertStatus(404)
  })

  test('A não alcança a plataforma', async ({ client }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    ;(
      await authed(client, 'get', `/api/v1/platform/restaurants/${b.restaurant.id}`, cookie)
    ).assertStatus(403)
    ;(
      await authed(
        client,
        'patch',
        `/api/v1/platform/restaurants/${b.restaurant.id}/status`,
        cookie
      ).json({
        is_active: false,
      })
    ).assertStatus(403)
  })
})
