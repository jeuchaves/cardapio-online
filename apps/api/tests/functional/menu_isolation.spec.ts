import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import type { ApiClient } from '@japa/api-client'
import {
  authed,
  createRestaurant,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'

// F3-T8: isolamento multi-tenant do cardápio, com dois restaurantes e matriz de usuários.

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(56, 0x22),
])
const MENU_TABLES = ['categories', 'products', 'product_addons', 'product_product_addons']

type Route = {
  label: string
  method: 'get' | 'post' | 'patch' | 'put' | 'delete'
  path: string
  body?: object
  upload?: boolean
}

async function buildRestaurant(tag: string) {
  const restaurant = await createRestaurant()
  const owner = await createUser()
  const staff = await createUser()
  await link(owner, restaurant, 'owner')
  await link(staff, restaurant, 'staff')

  const [category] = await db
    .table('categories')
    .insert({ restaurant_id: restaurant.id, name: `Categoria ${tag}` })
    .returning('id')
  const imageKey = `restaurants/${restaurant.id}/products/${crypto.randomUUID()}.png`
  const logoKey = `restaurants/${restaurant.id}/logo/${crypto.randomUUID()}.png`
  await drive.use().put(imageKey, PNG)
  await drive.use().put(logoKey, PNG)
  await db.from('restaurants').where('id', restaurant.id).update({ logo: logoKey })
  const [product] = await db
    .table('products')
    .insert({
      restaurant_id: restaurant.id,
      category_id: category.id,
      name: `Produto ${tag}`,
      price: '10.00',
      image: imageKey,
    })
    .returning('id')
  const [addon] = await db
    .table('product_addons')
    .insert({ restaurant_id: restaurant.id, name: `Adicional ${tag}`, price: '2.00' })
    .returning('id')
  const [spare] = await db
    .table('product_addons')
    .insert({ restaurant_id: restaurant.id, name: `Reserva ${tag}`, price: '1.00' })
    .returning('id')
  await db.table('product_product_addons').insert({
    product_id: product.id,
    product_addon_id: addon.id,
    restaurant_id: restaurant.id,
  })
  return {
    restaurant,
    owner,
    staff,
    categoryId: category.id as string,
    productId: product.id as string,
    addonId: addon.id as string,
    spareAddonId: spare.id as string,
    imageKey,
    logoKey,
  }
}

/** Todas as rotas de cardápio e de imagem do tenant, apontando para os recursos informados. */
function menuRoutes(restaurantId: string, ids: { c: string; p: string; a: string }): Route[] {
  const t = `/api/v1/tenant/${restaurantId}`
  return [
    { label: 'GET categories', method: 'get', path: `${t}/categories` },
    { label: 'POST categories', method: 'post', path: `${t}/categories`, body: { name: 'Nova' } },
    {
      label: 'PATCH category',
      method: 'patch',
      path: `${t}/categories/${ids.c}`,
      body: { name: 'X' },
    },
    { label: 'DELETE category', method: 'delete', path: `${t}/categories/${ids.c}` },
    { label: 'GET products', method: 'get', path: `${t}/products` },
    {
      label: 'POST products',
      method: 'post',
      path: `${t}/products`,
      body: { category_id: ids.c, name: 'Novo', price: '1.00' },
    },
    {
      label: 'PATCH product',
      method: 'patch',
      path: `${t}/products/${ids.p}`,
      body: { name: 'X' },
    },
    {
      label: 'PATCH product (disponibilidade)',
      method: 'patch',
      path: `${t}/products/${ids.p}`,
      body: { is_available: false },
    },
    { label: 'DELETE product', method: 'delete', path: `${t}/products/${ids.p}` },
    {
      label: 'PUT product addons',
      method: 'put',
      path: `${t}/products/${ids.p}/addons`,
      body: { addon_ids: [ids.a] },
    },
    {
      label: 'PUT product image',
      method: 'put',
      path: `${t}/products/${ids.p}/image`,
      upload: true,
    },
    { label: 'DELETE product image', method: 'delete', path: `${t}/products/${ids.p}/image` },
    { label: 'GET addons', method: 'get', path: `${t}/addons` },
    {
      label: 'POST addons',
      method: 'post',
      path: `${t}/addons`,
      body: { name: 'Novo', price: '1.00' },
    },
    { label: 'PATCH addon', method: 'patch', path: `${t}/addons/${ids.a}`, body: { name: 'X' } },
    {
      label: 'PATCH addon (disponibilidade)',
      method: 'patch',
      path: `${t}/addons/${ids.a}`,
      body: { is_available: false },
    },
    { label: 'DELETE addon', method: 'delete', path: `${t}/addons/${ids.a}` },
    { label: 'PUT restaurant logo', method: 'put', path: `${t}/restaurant/logo`, upload: true },
  ]
}

function call(client: ApiClient, cookie: string, route: Route) {
  const request = authed(client, route.method, route.path, cookie)
  if (route.upload) {
    return request.file('file', PNG, { filename: 'a.png', contentType: 'image/png' })
  }
  return route.body ? request.json(route.body) : request
}

async function filesInStorage() {
  const { readdir } = await import('node:fs/promises')
  try {
    const entries = await readdir(app.makePath('tmp/test-storage'), {
      recursive: true,
      withFileTypes: true,
    })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

/** Estado completo do cardápio e dos arquivos: serve para provar que nada mudou. */
async function snapshot() {
  const rows = async (table: string, order: string) =>
    (await db.from(table).orderBy(order).select('*')).map((row) => ({
      ...row,
      created_at: undefined,
      updated_at: undefined,
    }))
  return JSON.stringify({
    categories: await rows('categories', 'id'),
    products: await rows('products', 'id'),
    addons: await rows('product_addons', 'id'),
    links: await rows('product_product_addons', 'product_addon_id'),
    restaurants: await rows('restaurants', 'id'),
    files: await filesInStorage(),
  })
}

type Captured = { sql: string; bindings: unknown[] }

/** Registra o SQL executado: usado para revisar, em tempo de execução, cada consulta do cardápio. */
function captureQueries() {
  const queries: Captured[] = []
  const knex = db.connection().getWriteClient()
  const listener = (query: { sql: string; bindings?: unknown[] }) => {
    queries.push({ sql: query.sql, bindings: query.bindings ?? [] })
  }
  knex.on('query', listener)
  return {
    queries,
    stop() {
      knex.off('query', listener)
    },
  }
}

const touchesMenu = (sql: string) => MENU_TABLES.some((table) => sql.includes(`"${table}"`))

/**
 * Revisão em tempo de execução: toda consulta que toca uma tabela do cardápio filtra (ou grava)
 * `restaurant_id`, e nenhuma delas recebe o id de um restaurante diferente do autorizado.
 */
function assertTenantScoped(
  assert: { isTrue(v: unknown, m?: string): void; isFalse(v: unknown, m?: string): void },
  queries: Captured[],
  authorizedRestaurantId: string,
  foreignRestaurantIds: string[]
) {
  for (const query of queries.filter((q) => touchesMenu(q.sql))) {
    assert.isTrue(query.sql.includes('restaurant_id'), `sem filtro por restaurant_id: ${query.sql}`)
    assert.isTrue(
      query.bindings.includes(authorizedRestaurantId),
      `consulta sem o restaurante autorizado: ${query.sql}`
    )
    for (const foreign of foreignRestaurantIds) {
      assert.isFalse(
        query.bindings.includes(foreign),
        `consulta com restaurante alheio: ${query.sql}`
      )
    }
  }
}

const resetAll = async () => {
  await resetState()
  await rm(app.makePath('tmp/test-storage'), { recursive: true, force: true })
  await rm(app.tmpPath('uploads'), { recursive: true, force: true })
}

test.group('Isolamento do cardápio | quem não tem vínculo com o restaurante', (group) => {
  group.each.setup(resetAll)
  group.teardown(resetAll)

  test('sem vínculo, vínculo inativo e platform_admin: 404 em todas as rotas, nada muda e nenhuma consulta toca o cardápio', async ({
    client,
    assert,
  }) => {
    const a = await buildRestaurant('A')
    const b = await buildRestaurant('B')

    // Sessão aberta com vínculo e depois perdido (removido) ou desativado
    const unlinked = await createUser()
    const unlinkedLink = await link(unlinked, b.restaurant, 'owner')
    const unlinkedCookie = await loginAndGetCookie(client, unlinked.email)
    await unlinkedLink.delete()

    const inactive = await createUser()
    const inactiveLink = await link(inactive, b.restaurant, 'owner')
    const inactiveCookie = await loginAndGetCookie(client, inactive.email)
    inactiveLink.isActive = false
    await inactiveLink.save()

    const admin = await createUser({ isPlatformAdmin: true })
    const adminCookie = await loginAndGetCookie(client, admin.email)

    const actors = [
      { name: 'sem vínculo', cookie: unlinkedCookie },
      { name: 'vínculo inativo', cookie: inactiveCookie },
      { name: 'platform_admin', cookie: adminCookie },
      { name: 'owner de A', cookie: await loginAndGetCookie(client, a.owner.email) },
      { name: 'staff de A', cookie: await loginAndGetCookie(client, a.staff.email) },
    ]
    const routes = menuRoutes(b.restaurant.id, { c: b.categoryId, p: b.productId, a: b.addonId })
    const before = await snapshot()
    const capture = captureQueries()

    for (const actor of actors) {
      for (const route of routes) {
        const response = await call(client, actor.cookie, route)
        assert.equal(response.status(), 404, `${actor.name} → ${route.label}`)
      }
    }
    capture.stop()

    assert.equal(await snapshot(), before)
    // O middleware de tenant barra antes de qualquer consulta ao cardápio
    assert.lengthOf(
      capture.queries.filter((q) => touchesMenu(q.sql)),
      0
    )
    assert.isTrue(capture.queries.some((q) => q.sql.includes('restaurant_users')))
  })

  test('o restaurante do próprio usuário continua acessível pelas mesmas rotas (controle positivo)', async ({
    client,
    assert,
  }) => {
    const a = await buildRestaurant('A')
    await buildRestaurant('B')
    const cookie = await loginAndGetCookie(client, a.owner.email)
    for (const route of menuRoutes(a.restaurant.id, {
      c: a.categoryId,
      p: a.productId,
      a: a.addonId,
    })) {
      if (route.method === 'delete') continue
      const response = await call(client, cookie, route)
      assert.include([200, 201, 204, 409, 422], response.status(), route.label)
      assert.notEqual(response.status(), 404, route.label)
    }
  })
})

test.group(
  'Isolamento do cardápio | ids de outro restaurante pelo próprio restaurante',
  (group) => {
    group.each.setup(resetAll)
    group.teardown(resetAll)

    test('owner e staff de A com ids de B: 404, nada muda, consultas sempre filtradas por A', async ({
      client,
      assert,
    }) => {
      const a = await buildRestaurant('A')
      const b = await buildRestaurant('B')
      const idsOfB = { c: b.categoryId, p: b.productId, a: b.addonId }
      // Só as rotas que usam o id de um recurso existente (as demais não recebem id)
      const routes = menuRoutes(a.restaurant.id, idsOfB).filter(
        (route) =>
          /category|product|addon/.test(route.label) &&
          /\/(categories|products|addons)\/[0-9a-f-]{36}/.test(route.path)
      )
      assert.isAbove(routes.length, 8)

      for (const user of [a.owner, a.staff]) {
        const cookie = await loginAndGetCookie(client, user.email)
        const before = await snapshot()
        const capture = captureQueries()
        for (const route of routes) {
          const response = await call(client, cookie, route)
          // Rotas só de owner respondem 403 ao staff antes de olhar o recurso
          const expected =
            user === a.staff && /^DELETE|disponibilidade|logo/.test(route.label) ? 403 : 404
          assert.equal(response.status(), expected, `${user.email} → ${route.label}`)
        }
        capture.stop()
        assert.equal(await snapshot(), before)
        assertTenantScoped(assert, capture.queries, a.restaurant.id, [b.restaurant.id])
        assert.isAbove(capture.queries.filter((q) => touchesMenu(q.sql)).length, 0)
      }
    })

    test('referências cruzadas no corpo e no filtro são recusadas e nada de B vaza', async ({
      client,
      assert,
    }) => {
      const a = await buildRestaurant('A')
      const b = await buildRestaurant('B')
      const cookie = await loginAndGetCookie(client, a.owner.email)
      const t = `/api/v1/tenant/${a.restaurant.id}`
      const before = await snapshot()
      const capture = captureQueries()

      // Produto em categoria de B (criação e movimentação)
      ;(
        await authed(client, 'post', `${t}/products`, cookie).json({
          category_id: b.categoryId,
          name: 'Intruso',
          price: '1.00',
        })
      ).assertStatus(422)
      ;(
        await authed(client, 'patch', `${t}/products/${a.productId}`, cookie).json({
          category_id: b.categoryId,
        })
      ).assertStatus(422)
      // Adicional de B em produto de A, sozinho ou misturado com um válido
      for (const addonIds of [[b.addonId], [a.addonId, b.addonId], [b.addonId, b.spareAddonId]]) {
        const response = await authed(
          client,
          'put',
          `${t}/products/${a.productId}/addons`,
          cookie
        ).json({
          addon_ids: addonIds,
        })
        assert.equal(response.status(), 422)
      }
      // Filtro por categoria de B: lista vazia, sem dados de B
      const filtered = await authed(
        client,
        'get',
        `${t}/products?category_id=${b.categoryId}`,
        cookie
      )
      filtered.assertStatus(200)
      assert.lengthOf(filtered.body().data, 0)
      assert.equal(filtered.body().meta.total, 0)
      // Listagens trazem só o que é de A
      for (const resource of ['categories', 'products', 'addons']) {
        const response = await authed(client, 'get', `${t}/${resource}`, cookie)
        const text = JSON.stringify(response.body())
        assert.notInclude(text, b.categoryId)
        assert.notInclude(text, b.productId)
        assert.notInclude(text, b.addonId)
        assert.notInclude(text, b.restaurant.id)
      }
      capture.stop()

      assert.equal(await snapshot(), before)
      assertTenantScoped(assert, capture.queries, a.restaurant.id, [b.restaurant.id])
    })

    test('toda consulta do cardápio nas operações permitidas carrega restaurant_id do tenant autorizado', async ({
      client,
      assert,
    }) => {
      const a = await buildRestaurant('A')
      const b = await buildRestaurant('B')
      const cookie = await loginAndGetCookie(client, a.owner.email)
      const capture = captureQueries()

      // Percorre todas as operações com recursos do próprio restaurante, inclusive as transacionais
      const routes = menuRoutes(a.restaurant.id, { c: a.categoryId, p: a.productId, a: a.addonId })
      const order = ['GET', 'POST', 'PATCH', 'PUT']
      const safe = routes.filter((route) => order.some((m) => route.label.startsWith(m)))
      for (const route of safe) await call(client, cookie, route)
      await call(
        client,
        cookie,
        routes.find((r) => r.label === 'DELETE product image')!
      )
      await call(
        client,
        cookie,
        routes.find((r) => r.label === 'DELETE addon')!
      )
      await call(
        client,
        cookie,
        routes.find((r) => r.label === 'DELETE product')!
      )
      await call(
        client,
        cookie,
        routes.find((r) => r.label === 'DELETE category')!
      )
      capture.stop()

      const menu = capture.queries.filter((q) => touchesMenu(q.sql))
      assert.isAbove(menu.length, 15)
      // As consultas transacionais (FOR UPDATE / FOR SHARE) também foram observadas
      assert.isTrue(menu.some((q) => /for update/i.test(q.sql)))
      assert.isTrue(menu.some((q) => /for share/i.test(q.sql)))
      assertTenantScoped(assert, capture.queries, a.restaurant.id, [b.restaurant.id])

      // B segue intacto
      assert.lengthOf(await db.from('categories').where('restaurant_id', b.restaurant.id), 1)
      assert.lengthOf(await db.from('products').where('restaurant_id', b.restaurant.id), 1)
      assert.lengthOf(await db.from('product_addons').where('restaurant_id', b.restaurant.id), 2)
      assert.lengthOf(
        await db.from('product_product_addons').where('restaurant_id', b.restaurant.id),
        1
      )
      assert.isTrue(await drive.use().exists(b.imageKey))
      assert.isTrue(await drive.use().exists(b.logoKey))
    })

    test('imagens: o arquivo de B nunca é tocado por A, e as chaves novas ficam no restaurante de A', async ({
      client,
      assert,
    }) => {
      const a = await buildRestaurant('A')
      const b = await buildRestaurant('B')
      const cookie = await loginAndGetCookie(client, a.owner.email)

      // Produto e logo de B pelo próprio restaurante e pelo restaurante de B
      for (const restaurantId of [a.restaurant.id, b.restaurant.id]) {
        ;(
          await authed(
            client,
            'put',
            `/api/v1/tenant/${restaurantId}/products/${b.productId}/image`,
            cookie
          ).file('file', PNG, { filename: 'a.png', contentType: 'image/png' })
        ).assertStatus(404)
        ;(
          await authed(
            client,
            'delete',
            `/api/v1/tenant/${restaurantId}/products/${b.productId}/image`,
            cookie
          )
        ).assertStatus(404)
      }
      ;(
        await authed(
          client,
          'put',
          `/api/v1/tenant/${b.restaurant.id}/restaurant/logo`,
          cookie
        ).file('file', PNG, {
          filename: 'a.png',
          contentType: 'image/png',
        })
      ).assertStatus(404)
      assert.isTrue(await drive.use().exists(b.imageKey))
      assert.isTrue(await drive.use().exists(b.logoKey))
      assert.equal((await db.from('products').where('id', b.productId).first()).image, b.imageKey)

      // O que A envia vai sempre para o prefixo de A
      const product = await authed(
        client,
        'put',
        `/api/v1/tenant/${a.restaurant.id}/products/${a.productId}/image`,
        cookie
      ).file('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      product.assertStatus(200)
      assert.include(
        product.body().data.image_url,
        `/uploads/restaurants/${a.restaurant.id}/products/`
      )
      const logo = await authed(
        client,
        'put',
        `/api/v1/tenant/${a.restaurant.id}/restaurant/logo`,
        cookie
      ).file('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      assert.include(logo.body().data.logo_url, `/uploads/restaurants/${a.restaurant.id}/logo/`)
    })
  }
)

test.group('Isolamento do cardápio | usuário com vínculos em dois restaurantes', (group) => {
  group.each.setup(resetAll)
  group.teardown(resetAll)

  async function multiLink(client: ApiClient) {
    const a = await buildRestaurant('A')
    const b = await buildRestaurant('B')
    const user = await createUser()
    await link(user, a.restaurant, 'owner')
    await link(user, b.restaurant, 'staff')
    return { a, b, user, cookie: await loginAndGetCookie(client, user.email) }
  }

  test('cada restaurante é acessado só pelo vínculo correspondente (owner em A, staff em B)', async ({
    client,
    assert,
  }) => {
    const { a, b, cookie } = await multiLink(client)
    const ta = `/api/v1/tenant/${a.restaurant.id}`
    const tb = `/api/v1/tenant/${b.restaurant.id}`

    // Em B é staff: edita, mas não exclui nem altera disponibilidade
    ;(
      await authed(client, 'patch', `${tb}/products/${b.productId}`, cookie).json({
        name: 'Editado',
      })
    ).assertStatus(200)
    ;(
      await authed(client, 'patch', `${tb}/products/${b.productId}`, cookie).json({
        is_available: true,
      })
    ).assertStatus(403)
    ;(await authed(client, 'delete', `${tb}/products/${b.productId}`, cookie)).assertStatus(403)
    ;(await authed(client, 'delete', `${tb}/categories/${b.categoryId}`, cookie)).assertStatus(403)
    ;(await authed(client, 'delete', `${tb}/addons/${b.addonId}`, cookie)).assertStatus(403)
    ;(await authed(client, 'delete', `${tb}/products/${b.productId}/image`, cookie)).assertStatus(
      403
    )
    ;(
      await authed(client, 'put', `${tb}/restaurant/logo`, cookie).file('file', PNG, {
        filename: 'a.png',
        contentType: 'image/png',
      })
    ).assertStatus(403)
    assert.equal((await db.from('products').where('id', b.productId).first()).name, 'Editado')

    // Em A é owner: o papel de B não limita A
    ;(
      await authed(client, 'patch', `${ta}/products/${a.productId}`, cookie).json({
        is_available: false,
      })
    ).assertStatus(200)
    ;(
      await authed(client, 'put', `${ta}/restaurant/logo`, cookie).file('file', PNG, {
        filename: 'a.png',
        contentType: 'image/png',
      })
    ).assertStatus(200)
    ;(await authed(client, 'delete', `${ta}/addons/${a.spareAddonId}`, cookie)).assertStatus(204)

    // Cada listagem mostra só o restaurante pedido
    for (const [t, own, other] of [
      [ta, a, b],
      [tb, b, a],
    ] as const) {
      const products = await authed(client, 'get', `${t}/products`, cookie)
      assert.deepEqual(
        products.body().data.map((p: { id: string }) => p.id),
        [own.productId]
      )
      const text = JSON.stringify(products.body())
      assert.notInclude(text, other.productId)
      assert.notInclude(text, other.addonId)
    }
  })

  test('os dois vínculos não se misturam: ids de um restaurante no outro dão 404 ou 422 e nada muda', async ({
    client,
    assert,
  }) => {
    const { a, b, cookie } = await multiLink(client)
    const before = await snapshot()
    const capture = captureQueries()

    for (const [own, other] of [
      [a, b],
      [b, a],
    ] as const) {
      const routes = menuRoutes(own.restaurant.id, {
        c: other.categoryId,
        p: other.productId,
        a: other.addonId,
      }).filter((route) => /\/(categories|products|addons)\/[0-9a-f-]{36}/.test(route.path))
      for (const route of routes) {
        const response = await call(client, cookie, route)
        // Em B o usuário é staff: rotas só de owner respondem 403 antes de olhar o recurso
        const ownerOnly = /^DELETE|disponibilidade|logo/.test(route.label)
        const expected = own === b && ownerOnly ? 403 : 404
        assert.equal(response.status(), expected, `${own.restaurant.id} → ${route.label}`)
      }
      ;(
        await authed(client, 'post', `/api/v1/tenant/${own.restaurant.id}/products`, cookie).json({
          category_id: other.categoryId,
          name: 'Cruzado',
          price: '1.00',
        })
      ).assertStatus(422)
      ;(
        await authed(
          client,
          'put',
          `/api/v1/tenant/${own.restaurant.id}/products/${own.productId}/addons`,
          cookie
        ).json({ addon_ids: [other.addonId] })
      ).assertStatus(422)
    }
    capture.stop()

    assert.equal(await snapshot(), before)
    // Cada consulta usa exatamente um dos dois restaurantes, nunca os dois ao mesmo tempo
    for (const query of capture.queries.filter((q) => touchesMenu(q.sql))) {
      assert.isTrue(query.sql.includes('restaurant_id'), query.sql)
      const used = [a.restaurant.id, b.restaurant.id].filter((id) => query.bindings.includes(id))
      assert.lengthOf(used, 1, query.sql)
    }
  })

  test('perder o vínculo ou ser desativado em um restaurante não afeta o outro, na mesma sessão', async ({
    client,
    assert,
  }) => {
    const { a, b, user, cookie } = await multiLink(client)
    const tb = `/api/v1/tenant/${b.restaurant.id}`
    const ta = `/api/v1/tenant/${a.restaurant.id}`
    ;(await authed(client, 'get', `${tb}/products`, cookie)).assertStatus(200)

    await db
      .from('restaurant_users')
      .where({ user_id: user.id, restaurant_id: b.restaurant.id })
      .update({ is_active: false })
    ;(await authed(client, 'get', `${tb}/products`, cookie)).assertStatus(404)
    ;(await authed(client, 'get', `${tb}/addons`, cookie)).assertStatus(404)
    ;(await authed(client, 'get', `${ta}/products`, cookie)).assertStatus(200)
    ;(
      await authed(client, 'patch', `${ta}/products/${a.productId}`, cookie).json({
        name: 'Ainda funciona',
      })
    ).assertStatus(200)
    assert.equal((await db.from('products').where('id', b.productId).first()).name, 'Produto B')
  })
})
