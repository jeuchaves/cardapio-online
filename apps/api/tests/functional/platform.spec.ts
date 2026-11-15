import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import RestaurantUser from '#models/restaurant_user'
import User from '#models/user'
import {
  PASSWORD,
  authed,
  createRestaurant,
  createUser,
  link,
  loginAndGetCookie,
  loginRequest,
  resetState,
} from '#tests/helpers'

const URL = '/api/v1/platform/restaurants'

async function adminCookie(client: Parameters<typeof authed>[0]) {
  const admin = await createUser({ isPlatformAdmin: true })
  return { admin, cookie: await loginAndGetCookie(client, admin.email) }
}

const newRestaurant = (overrides: Record<string, unknown> = {}) => ({
  name: 'Casa do Sabor',
  slug: 'casa-do-sabor',
  owner: { name: 'Maria Dona', email: 'maria@exemplo.com' },
  ...overrides,
})

test.group('Plataforma | autorização', (group) => {
  group.each.setup(resetState)

  test('sem sessão 401; owner e staff 403; senha temporária pendente 403', async ({ client }) => {
    ;(await client.get(URL)).assertStatus(401)

    const restaurant = await createRestaurant()
    const owner = await createUser()
    const staff = await createUser()
    await link(owner, restaurant, 'owner')
    await link(staff, restaurant, 'staff')
    for (const user of [owner, staff]) {
      const cookie = await loginAndGetCookie(client, user.email)
      ;(await authed(client, 'get', URL, cookie)).assertStatus(403)
      ;(await authed(client, 'post', URL, cookie).json(newRestaurant())).assertStatus(403)
    }

    const pending = await createUser({ isPlatformAdmin: true, mustChangePassword: true })
    const cookie = await loginAndGetCookie(client, pending.email)
    const response = await authed(client, 'get', URL, cookie)
    response.assertStatus(403)
    response.assertBodyContains({ code: 'PASSWORD_CHANGE_REQUIRED' })
  })
})

test.group('Plataforma | cadastro de restaurante', (group) => {
  group.each.setup(resetState)

  test('cria restaurante e owner novo com senha temporária, na mesma transação', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const response = await authed(client, 'post', URL, cookie).json(
      newRestaurant({ description: 'Comida caseira', phone: '(11) 99999-0000' })
    )

    response.assertStatus(201)
    assert.equal(response.header('cache-control'), 'no-store')
    const { restaurant, owner } = response.body().data
    assert.equal(restaurant.slug, 'casa-do-sabor')
    assert.isString(owner.temporary_password)
    assert.lengthOf(owner.temporary_password, 16)

    const user = await User.findOrFail(owner.id)
    assert.isTrue(user.mustChangePassword)
    assert.notEqual(user.password, owner.temporary_password)
    assert.isTrue(await hash.verify(user.password, owner.temporary_password))
    const links = await RestaurantUser.query().where('user_id', user.id)
    assert.lengthOf(links, 1)
    assert.equal(links[0].role, 'owner')
    assert.equal(links[0].restaurantId, restaurant.id)

    // A senha temporária funciona e obriga a troca
    const login = await loginRequest(client, 'maria@exemplo.com', owner.temporary_password)
    login.assertStatus(200)
    login.assertBodyContains({ data: { user: { must_change_password: true } } })
  })

  test('a senha temporária e dados pessoais não vão para o log de auditoria', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const captured: string[] = []
    const original = logger.info
    logger.info = ((...args: unknown[]) => {
      captured.push(JSON.stringify(args))
    }) as typeof logger.info
    let password = ''
    try {
      const response = await authed(client, 'post', URL, cookie).json(
        newRestaurant({ phone: '11999990000' })
      )
      password = response.body().data.owner.temporary_password
    } finally {
      logger.info = original
    }

    const audits = captured.filter((entry) => entry.includes('"audit":true'))
    assert.isAtLeast(audits.length, 2)
    const logs = captured.join('\n')
    assert.notInclude(logs, password)
    assert.notInclude(logs, '11999990000')
    assert.notInclude(logs, 'maria@exemplo.com')
  })

  test('e-mail existente: 409 sem confirmação; com confirmação só vincula', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const existing = await createUser({ email: 'maria@exemplo.com', name: 'Nome Original' })
    const passwordBefore = existing.password

    const refused = await authed(client, 'post', URL, cookie).json(newRestaurant())
    refused.assertStatus(409)
    refused.assertBodyContains({ code: 'EMAIL_TAKEN' })
    assert.lengthOf(await db.from('restaurants').select('id'), 0)

    const linked = await authed(client, 'post', URL, cookie).json(
      newRestaurant({
        owner: { name: 'Outro Nome', email: 'MARIA@exemplo.com' },
        confirm_link_existing_user: true,
      })
    )
    linked.assertStatus(201)
    assert.notProperty(linked.body().data.owner, 'temporary_password')

    const after = await User.findOrFail(existing.id)
    assert.equal(after.password, passwordBefore)
    assert.equal(after.name, 'Nome Original')
    assert.isFalse(after.mustChangePassword)
    assert.lengthOf(await RestaurantUser.query().where('user_id', existing.id), 1)
  })

  test('D7: platform_admin não pode ser vinculado como owner', async ({ client, assert }) => {
    const { cookie, admin } = await adminCookie(client)
    const response = await authed(client, 'post', URL, cookie).json(
      newRestaurant({
        owner: { name: 'Admin', email: admin.email },
        confirm_link_existing_user: true,
      })
    )
    response.assertStatus(422)
    assert.lengthOf(await db.from('restaurants').select('id'), 0)
    assert.lengthOf(await db.from('restaurant_users').select('id'), 0)
  })

  test('slug: duplicado (sem distinção de caixa), reservado e formato inválido', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    ;(await authed(client, 'post', URL, cookie).json(newRestaurant())).assertStatus(201)

    const duplicate = await authed(client, 'post', URL, cookie).json(
      newRestaurant({ slug: 'CASA-DO-SABOR', owner: { name: 'B', email: 'b@exemplo.com' } })
    )
    duplicate.assertStatus(409)
    duplicate.assertBodyContains({ code: 'SLUG_TAKEN' })

    for (const slug of ['admin', 'API', 'r', 'painel', '_next', 'ab', 'com espaço', 'a--b']) {
      const response = await authed(client, 'post', URL, cookie).json(
        newRestaurant({ slug, owner: { name: 'C', email: 'c@exemplo.com' } })
      )
      response.assertStatus(422)
    }
    assert.lengthOf(await db.from('restaurants').select('id'), 1)
    assert.lengthOf(await db.from('users').select('id'), 2)
  })

  test('campos desconhecidos são rejeitados', async ({ client }) => {
    const { cookie } = await adminCookie(client)
    ;(
      await authed(client, 'post', URL, cookie).json(newRestaurant({ is_active: false }))
    ).assertStatus(422)
    ;(
      await authed(client, 'post', URL, cookie).json(
        newRestaurant({ owner: { name: 'A', email: 'a@exemplo.com', is_platform_admin: true } })
      )
    ).assertStatus(422)
  })

  test('falha no meio da transação não deixa restaurante nem usuário', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const original = RestaurantUser.create
    RestaurantUser.create = (async () => {
      throw new Error('falha simulada')
    }) as unknown as typeof RestaurantUser.create
    try {
      ;(await authed(client, 'post', URL, cookie).json(newRestaurant())).assertStatus(500)
    } finally {
      RestaurantUser.create = original
    }
    assert.lengthOf(await db.from('restaurants').select('id'), 0)
    assert.lengthOf(await db.from('users').where('email', 'maria@exemplo.com').select('id'), 0)
  })
})

test.group('Plataforma | administração', (group) => {
  group.each.setup(resetState)

  test('lista com paginação, busca e filtro, sem dados de pedidos', async ({ client, assert }) => {
    const { cookie } = await adminCookie(client)
    await createRestaurant({ name: 'Alfa Pizzaria', slug: 'alfa' })
    await createRestaurant({ name: 'Beta Burger', slug: 'beta' })
    const gama = await createRestaurant({ name: 'Gama 100%', slug: 'gama' })
    await db.from('restaurants').where('id', gama.id).update({ is_active: false })

    const all = await authed(client, 'get', `${URL}?per_page=2&page=1`, cookie)
    all.assertStatus(200)
    assert.deepEqual(all.body().meta, { page: 1, per_page: 2, total: 3 })
    assert.lengthOf(all.body().data, 2)
    assert.sameMembers(Object.keys(all.body().data[0]), [
      'id',
      'name',
      'slug',
      'is_active',
      'created_at',
    ])

    const search = await authed(client, 'get', `${URL}?search=pizza`, cookie)
    assert.deepEqual(
      search.body().data.map((r: { slug: string }) => r.slug),
      ['alfa']
    )
    // Curinga do LIKE é literal
    const wildcard = await authed(client, 'get', `${URL}?search=%25`, cookie)
    assert.deepEqual(
      wildcard.body().data.map((r: { slug: string }) => r.slug),
      ['gama']
    )
    const inactive = await authed(client, 'get', `${URL}?is_active=false`, cookie)
    assert.deepEqual(
      inactive.body().data.map((r: { slug: string }) => r.slug),
      ['gama']
    )
    ;(await authed(client, 'get', `${URL}?per_page=1000`, cookie)).assertStatus(422)
  })

  test('detalhe: 404 para inexistente e id malformado', async ({ client, assert }) => {
    const { cookie } = await adminCookie(client)
    const restaurant = await createRestaurant()
    const owner = await createUser()
    await link(owner, restaurant, 'owner')
    const detail = await authed(client, 'get', `${URL}/${restaurant.id}`, cookie)
    detail.assertStatus(200)
    // APR-04: o detalhe não expõe dados pessoais dos usuários do restaurante
    assert.notProperty(detail.body().data, 'owners')
    assert.notInclude(JSON.stringify(detail.body()), owner.email)
    ;(
      await authed(client, 'get', `${URL}/00000000-0000-4000-8000-000000000000`, cookie)
    ).assertStatus(404)
    ;(await authed(client, 'get', `${URL}/nao-e-uuid`, cookie)).assertStatus(404)
  })

  test('edição: alterar o slug exige confirmação; conflito responde 409', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const restaurant = await createRestaurant({ slug: 'um' + 'a-casa' })
    await createRestaurant({ slug: 'outra-casa' })
    const url = `${URL}/${restaurant.id}`

    const noConfirm = await authed(client, 'patch', url, cookie).json({ slug: 'nova-casa' })
    noConfirm.assertStatus(422)
    ;(
      await authed(client, 'patch', url, cookie).json({
        slug: 'outra-casa',
        confirm_slug_change: true,
      })
    ).assertStatus(409)
    // Mesmo slug não precisa de confirmação
    ;(
      await authed(client, 'patch', url, cookie).json({ slug: 'uma-casa', name: 'Novo Nome' })
    ).assertStatus(200)
    const changed = await authed(client, 'patch', url, cookie).json({
      slug: 'nova-casa',
      confirm_slug_change: true,
    })
    changed.assertStatus(200)
    assert.equal(changed.body().data.slug, 'nova-casa')
    ;(await authed(client, 'patch', url, cookie).json({ is_active: false })).assertStatus(422)
    // Espaços em branco não são valores válidos para name e slug
    ;(await authed(client, 'patch', url, cookie).json({ name: '   ' })).assertStatus(422)
    ;(
      await authed(client, 'patch', url, cookie).json({ slug: '   ', confirm_slug_change: true })
    ).assertStatus(422)
  })

  test('reset de senha: restaurante com mais de um owner responde 409', async ({ client }) => {
    const { cookie } = await adminCookie(client)
    const restaurant = await createRestaurant()
    await link(await createUser(), restaurant, 'owner')
    await link(await createUser(), restaurant, 'owner')
    ;(
      await authed(client, 'post', `${URL}/${restaurant.id}/owner/reset-password`, cookie)
    ).assertStatus(409)
  })

  test('ativar e desativar; restaurante inativo continua acessível ao painel', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const restaurant = await createRestaurant()
    const owner = await createUser()
    await link(owner, restaurant, 'owner')

    const off = await authed(client, 'patch', `${URL}/${restaurant.id}/status`, cookie).json({
      is_active: false,
    })
    off.assertStatus(200)
    assert.isFalse(off.body().data.is_active)

    const ownerCookie = await loginAndGetCookie(client, owner.email)
    ;(
      await authed(client, 'get', `/api/v1/tenant/${restaurant.id}/restaurant`, ownerCookie)
    ).assertStatus(200)

    const on = await authed(client, 'patch', `${URL}/${restaurant.id}/status`, cookie).json({
      is_active: true,
    })
    assert.isTrue(on.body().data.is_active)
    ;(
      await authed(client, 'patch', `${URL}/${restaurant.id}/status`, cookie).json({
        is_active: 'talvez',
      })
    ).assertStatus(422)
  })

  test('reset de senha do owner: nova senha temporária e todas as sessões revogadas (D11)', async ({
    client,
    assert,
  }) => {
    const { cookie } = await adminCookie(client)
    const restaurant = await createRestaurant()
    const other = await createRestaurant()
    const owner = await createUser()
    const stranger = await createUser()
    await link(owner, restaurant, 'owner')
    await link(owner, other, 'owner')
    await link(stranger, other, 'owner')
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const secondCookie = await loginAndGetCookie(client, owner.email)

    const url = `${URL}/${restaurant.id}/owner/reset-password`
    // O alvo não é informado pelo cliente: corpo com campos é rejeitado
    ;(await authed(client, 'post', url, cookie).json({ user_id: stranger.id })).assertStatus(422)
    // Restaurante sem owner
    const empty = await createRestaurant()
    ;(await authed(client, 'post', `${URL}/${empty.id}/owner/reset-password`, cookie)).assertStatus(
      404
    )

    const response = await authed(client, 'post', url, cookie)
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'no-store')
    // A resposta traz só a senha, sem dados pessoais do owner
    assert.deepEqual(Object.keys(response.body().data), ['temporary_password'])
    const temporary = response.body().data.temporary_password
    assert.lengthOf(temporary, 16)

    // Sessões antigas caíram; senha antiga não vale; a temporária vale e exige troca
    ;(await authed(client, 'get', '/api/v1/auth/me', ownerCookie)).assertStatus(401)
    ;(await authed(client, 'get', '/api/v1/auth/me', secondCookie)).assertStatus(401)
    ;(await loginRequest(client, owner.email, PASSWORD)).assertStatus(401)
    const login = await loginRequest(client, owner.email, temporary)
    login.assertStatus(200)
    login.assertBodyContains({ data: { user: { must_change_password: true } } })
  })
})
