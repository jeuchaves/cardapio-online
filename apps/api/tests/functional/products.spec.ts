import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { authed, createRestaurantWithTeam, loginAndGetCookie, resetState } from '#tests/helpers'

const base = (restaurantId: string) => `/api/v1/tenant/${restaurantId}/products`

async function team() {
  const { restaurant, owner, staff } = await createRestaurantWithTeam()
  const categoryId = await insertCategory(restaurant.id, 'Lanches')
  return { restaurant, owner, staff, categoryId }
}

async function insertCategory(restaurantId: string, name: string) {
  const [row] = await db
    .table('categories')
    .insert({ restaurant_id: restaurantId, name })
    .returning('id')
  return row.id as string
}

async function insertProduct(
  restaurantId: string,
  categoryId: string,
  name: string,
  extra: Record<string, unknown> = {}
) {
  const [row] = await db
    .table('products')
    .insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name,
      price: '10.00',
      ...extra,
    })
    .returning('id')
  return row.id as string
}

test.group('Produtos | CRUD e autorização', (group) => {
  group.each.setup(resetState)

  test('owner cria, altera, move de categoria e exclui', async ({ client, assert }) => {
    const { restaurant, owner, categoryId } = await team()
    const otherCategory = await insertCategory(restaurant.id, 'Bebidas')
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)

    const created = await authed(client, 'post', url, cookie).json({
      category_id: categoryId,
      name: '  X-Burguer ',
      description: 'Pão e carne',
      price: '12.5',
    })
    created.assertStatus(201)
    const product = created.body().data
    assert.equal(product.name, 'X-Burguer')
    assert.strictEqual(product.price, '12.50')
    assert.isTrue(product.is_available)
    assert.deepEqual(product.addons, [])
    assert.notProperty(product, 'restaurant_id')

    const patched = await authed(client, 'patch', `${url}/${product.id}`, cookie).json({
      category_id: otherCategory,
      price: '0.10',
      is_available: false,
      description: null,
      sort_order: 3,
    })
    patched.assertStatus(200)
    assert.equal(patched.body().data.category_id, otherCategory)
    assert.strictEqual(patched.body().data.price, '0.10')
    assert.isFalse(patched.body().data.is_available)
    assert.isNull(patched.body().data.description)

    const stored = await db.from('products').where('id', product.id).first()
    assert.strictEqual(stored.price, '0.10')

    ;(await authed(client, 'delete', `${url}/${product.id}`, cookie)).assertStatus(204)
    assert.lengthOf(await db.from('products'), 0)
  })

  test('staff cria e altera, mas não envia is_available nem exclui', async ({ client, assert }) => {
    const { restaurant, staff, categoryId } = await team()
    const id = await insertProduct(restaurant.id, categoryId, 'Existente')
    const cookie = await loginAndGetCookie(client, staff.email)
    const url = base(restaurant.id)

    const created = await authed(client, 'post', url, cookie).json({
      category_id: categoryId,
      name: 'Novo',
      price: '5.00',
    })
    created.assertStatus(201)
    assert.isTrue(created.body().data.is_available)
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ name: 'Renomeado', price: '7' })
    ).assertStatus(200)

    // 403 mesmo com valor igual ao atual
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ is_available: true })
    ).assertStatus(403)
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ name: 'Y', is_available: true })
    ).assertStatus(403)
    ;(
      await authed(client, 'post', url, cookie).json({
        category_id: categoryId,
        name: 'Z',
        price: '1.00',
        is_available: true,
      })
    ).assertStatus(403)
    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(403)

    const row = await db.from('products').where('id', id).first()
    assert.equal(row.name, 'Renomeado')
    assert.lengthOf(await db.from('products'), 2)
  })

  test('sem sessão: 401; sem GET /:id', async ({ client }) => {
    const { restaurant, owner, categoryId } = await team()
    const id = await insertProduct(restaurant.id, categoryId, 'P')
    ;(await client.get(base(restaurant.id))).assertStatus(401)
    const cookie = await loginAndGetCookie(client, owner.email)
    ;(await authed(client, 'get', `${base(restaurant.id)}/${id}`, cookie)).assertStatus(404)
  })

  test('validação: campos desconhecidos, vazios, tipos e limites', async ({ client, assert }) => {
    const { restaurant, owner, categoryId } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const id = await insertProduct(restaurant.id, categoryId, 'Base')
    const valid = { category_id: categoryId, name: 'Ok', price: '1.00' }
    const post = (body: object) => authed(client, 'post', url, cookie).json(body)
    const patch = (body: object) => authed(client, 'patch', `${url}/${id}`, cookie).json(body)

    const unknown = await post({ ...valid, restaurant_id: restaurant.id, image: 'x' })
    unknown.assertStatus(422)
    assert.sameMembers(
      unknown.body().details.map((d: { field: string }) => d.field),
      ['restaurant_id', 'image']
    )
    ;(await patch({ id })).assertStatus(422)

    for (const body of [
      {},
      { ...valid, name: '' },
      { ...valid, name: '   ' },
      { ...valid, name: 'x'.repeat(121) },
      { ...valid, description: 'x'.repeat(1001) },
      { ...valid, sort_order: 10000 },
      { ...valid, sort_order: -1 },
      { ...valid, is_available: 'sim' },
      { ...valid, category_id: 'nao-uuid' },
      { name: 'Sem categoria', price: '1.00' },
      { category_id: categoryId, name: 'Sem preço' },
    ]) {
      ;(await post(body)).assertStatus(422)
    }
    for (const body of [
      {},
      { name: '' },
      { name: null },
      { price: null },
      { category_id: null },
      { sort_order: null },
      { is_available: null },
    ]) {
      ;(await patch(body)).assertStatus(422)
    }
    assert.lengthOf(await db.from('products'), 1)
  })

  test('preço: só string decimal, até 8 inteiros e 2 casas; number JSON é rejeitado', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, categoryId } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const id = await insertProduct(restaurant.id, categoryId, 'Base', { price: '9.99' })
    const post = (price: unknown) =>
      authed(client, 'post', url, cookie).json({ category_id: categoryId, name: 'P', price })
    const patch = (price: unknown) =>
      authed(client, 'patch', `${url}/${id}`, cookie).json({ price })

    for (const bad of [
      12.5,
      0,
      1,
      '-1',
      '-0.01',
      '12.345',
      '1e3',
      '1E2',
      '12,50',
      '.5',
      '5.',
      '',
      'abc',
      'NaN',
      'Infinity',
      '100000000.00',
      '100000000',
      '0x10',
      '+5',
      true,
      [],
      {},
    ]) {
      const response = await post(bad)
      assert.equal(response.status(), 422, `POST price ${JSON.stringify(bad)}`)
      assert.equal((await patch(bad)).status(), 422, `PATCH price ${JSON.stringify(bad)}`)
    }
    assert.lengthOf(await db.from('products'), 1)
    assert.strictEqual((await db.from('products').where('id', id).first()).price, '9.99')

    const cases: Record<string, string> = {
      '0': '0.00',
      '0.00': '0.00',
      '5': '5.00',
      '5.5': '5.50',
      '0.10': '0.10',
      '19.99': '19.99',
      '99999999.99': '99999999.99',
      '00012.5': '12.50',
      ' 7.5 ': '7.50', // o framework apara espaços nas bordas antes da validação
    }
    for (const [sent, stored] of Object.entries(cases)) {
      const response = await post(sent)
      response.assertStatus(201)
      assert.strictEqual(response.body().data.price, stored)
      const row = await db.from('products').where('id', response.body().data.id).first()
      assert.strictEqual(row.price, stored)
    }
  })

  test('produto não aceita categoria de outro restaurante (422), nem na criação nem na alteração', async ({
    client,
    assert,
  }) => {
    const a = await team()
    const b = await team()
    const id = await insertProduct(a.restaurant.id, a.categoryId, 'Do A')
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const url = base(a.restaurant.id)

    const create = await authed(client, 'post', url, cookie).json({
      category_id: b.categoryId,
      name: 'Intruso',
      price: '1.00',
    })
    create.assertStatus(422)
    create.assertBodyContains({ code: 'VALIDATION_ERROR' })
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ category_id: b.categoryId })
    ).assertStatus(422)
    ;(
      await authed(client, 'post', url, cookie).json({
        category_id: '00000000-0000-4000-8000-000000000000',
        name: 'Inexistente',
        price: '1.00',
      })
    ).assertStatus(422)

    const row = await db.from('products').where('id', id).first()
    assert.equal(row.category_id, a.categoryId)
    assert.lengthOf(await db.from('products'), 1)
  })

  test('criar produto em corrida com a exclusão da categoria nunca dá 500 nem produto órfão', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)

    for (let i = 0; i < 5; i++) {
      const categoryId = await insertCategory(restaurant.id, `Corrida ${i}`)
      const [create, remove] = await Promise.all([
        authed(client, 'post', base(restaurant.id), cookie).json({
          category_id: categoryId,
          name: `P${i}`,
          price: '1.00',
        }),
        authed(
          client,
          'delete',
          `/api/v1/tenant/${restaurant.id}/categories/${categoryId}`,
          cookie
        ),
      ])
      assert.include([201, 422], create.status())
      assert.include([204, 409], remove.status())
      const category = await db.from('categories').where('id', categoryId).first()
      const products = await db.from('products').where('category_id', categoryId)
      assert.isTrue(category !== null || products.length === 0)
      // Os dois resultados são coerentes entre si
      if (create.status() === 201) assert.equal(remove.status(), 409)
    }
  })
})

test.group('Produtos | listagem', (group) => {
  group.each.setup(resetState)

  test('ordenação determinística, filtro por categoria e paginação com meta', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, categoryId } = await team()
    const other = await insertCategory(restaurant.id, 'Bebidas')
    await insertProduct(restaurant.id, categoryId, 'B', { sort_order: 1 })
    await insertProduct(restaurant.id, categoryId, 'A', { sort_order: 1 })
    await insertProduct(restaurant.id, categoryId, 'Z', { sort_order: 0 })
    await insertProduct(restaurant.id, other, 'Suco', { sort_order: 0 })
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const names = (response: { body(): { data: { name: string }[] } }) =>
      response.body().data.map((p) => p.name)

    const all = await authed(client, 'get', url, cookie)
    all.assertStatus(200)
    assert.deepEqual(names(all), ['Suco', 'Z', 'A', 'B'])
    assert.deepEqual(all.body().meta, { page: 1, per_page: 20, total: 4 })

    const filtered = await authed(client, 'get', `${url}?category_id=${categoryId}`, cookie)
    assert.deepEqual(names(filtered), ['Z', 'A', 'B'])
    assert.equal(filtered.body().meta.total, 3)

    const page1 = await authed(client, 'get', `${url}?per_page=3&page=1`, cookie)
    const page2 = await authed(client, 'get', `${url}?per_page=3&page=2`, cookie)
    assert.deepEqual(names(page1), ['Suco', 'Z', 'A'])
    assert.deepEqual(names(page2), ['B'])
    assert.equal(page2.body().meta.total, 4)

    const beyond = await authed(client, 'get', `${url}?page=10000`, cookie)
    beyond.assertStatus(200)
    assert.lengthOf(beyond.body().data, 0)
  })

  test('limites e parâmetros inválidos de listagem: 422', async ({ client }) => {
    const { restaurant, owner } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    for (const query of [
      'page=0',
      'page=10001',
      'per_page=0',
      'per_page=101',
      'per_page=abc',
      'page=1.5',
      'category_id=nao-uuid',
      'restaurant_id=x',
      'search=a',
    ]) {
      ;(await authed(client, 'get', `${url}?${query}`, cookie)).assertStatus(422)
    }
    ;(await authed(client, 'get', `${url}?per_page=100&page=10000`, cookie)).assertStatus(200)
  })

  test('inclui os adicionais associados, ordenados, com preço como string', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, categoryId } = await team()
    const productId = await insertProduct(restaurant.id, categoryId, 'Com adicionais')
    const bareId = await insertProduct(restaurant.id, categoryId, 'Sem adicionais', {
      sort_order: 5,
    })
    const addon = async (name: string, price: string) => {
      const [row] = await db
        .table('product_addons')
        .insert({ restaurant_id: restaurant.id, name, price })
        .returning('id')
      await db.table('product_product_addons').insert({
        product_id: productId,
        product_addon_id: row.id,
        restaurant_id: restaurant.id,
      })
    }
    await addon('Queijo', '2.50')
    await addon('Bacon', '3.00')
    const cookie = await loginAndGetCookie(client, owner.email)

    const list = await authed(client, 'get', base(restaurant.id), cookie)
    const [withAddons, bare] = list.body().data
    assert.equal(withAddons.id, productId)
    assert.deepEqual(
      withAddons.addons.map((a: { name: string; price: string }) => [a.name, a.price]),
      [
        ['Bacon', '3.00'],
        ['Queijo', '2.50'],
      ]
    )
    assert.equal(bare.id, bareId)
    assert.deepEqual(bare.addons, [])
  })
})

test.group('Produtos | isolamento entre restaurantes', (group) => {
  group.each.setup(resetState)

  test('listagem mostra só os produtos do próprio restaurante, mesmo filtrando por categoria de B', async ({
    client,
    assert,
  }) => {
    const a = await team()
    const b = await team()
    await insertProduct(a.restaurant.id, a.categoryId, 'Do A')
    await insertProduct(b.restaurant.id, b.categoryId, 'Do B')
    const cookie = await loginAndGetCookie(client, a.owner.email)

    const list = await authed(client, 'get', base(a.restaurant.id), cookie)
    assert.deepEqual(
      list.body().data.map((p: { name: string }) => p.name),
      ['Do A']
    )
    assert.equal(list.body().meta.total, 1)

    const crossFilter = await authed(
      client,
      'get',
      `${base(a.restaurant.id)}?category_id=${b.categoryId}`,
      cookie
    )
    crossFilter.assertStatus(200)
    assert.lengthOf(crossFilter.body().data, 0)
    assert.equal(crossFilter.body().meta.total, 0)
  })

  test('usuário do A não acessa o restaurante B pelo restaurantId (404)', async ({
    client,
    assert,
  }) => {
    const a = await team()
    const b = await team()
    const idB = await insertProduct(b.restaurant.id, b.categoryId, 'Do B')
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const url = base(b.restaurant.id)

    ;(await authed(client, 'get', url, cookie)).assertStatus(404)
    ;(
      await authed(client, 'post', url, cookie).json({
        category_id: b.categoryId,
        name: 'Intruso',
        price: '1.00',
      })
    ).assertStatus(404)
    ;(await authed(client, 'patch', `${url}/${idB}`, cookie).json({ name: 'X' })).assertStatus(404)
    ;(await authed(client, 'delete', `${url}/${idB}`, cookie)).assertStatus(404)

    const row = await db.from('products').where('id', idB).first()
    assert.equal(row.name, 'Do B')
    assert.lengthOf(await db.from('products'), 1)
  })

  test('conhecendo o ID de B, alterar e excluir pelo próprio restaurante dá 404 e não muda nada', async ({
    client,
    assert,
  }) => {
    const a = await team()
    const b = await team()
    const idB = await insertProduct(b.restaurant.id, b.categoryId, 'Do B', { price: '4.00' })
    const url = `${base(a.restaurant.id)}/${idB}`

    for (const user of [a.owner, a.staff]) {
      const cookie = await loginAndGetCookie(client, user.email)
      ;(
        await authed(client, 'patch', url, cookie).json({ name: 'Invadido', price: '0.01' })
      ).assertStatus(404)
      // Mesmo movendo para uma categoria válida do próprio restaurante
      ;(
        await authed(client, 'patch', url, cookie).json({ category_id: a.categoryId })
      ).assertStatus(404)
    }
    const ownerCookie = await loginAndGetCookie(client, a.owner.email)
    ;(await authed(client, 'delete', url, ownerCookie)).assertStatus(404)
    ;(
      await authed(client, 'patch', `${base(a.restaurant.id)}/nao-e-uuid`, ownerCookie).json({
        name: 'X',
      })
    ).assertStatus(404)

    const row = await db.from('products').where('id', idB).first()
    assert.equal(row.name, 'Do B')
    assert.strictEqual(row.price, '4.00')
    assert.equal(row.category_id, b.categoryId)
  })

  test('restaurant_id no corpo nunca define o tenant', async ({ client, assert }) => {
    const a = await team()
    const b = await team()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    ;(
      await authed(client, 'post', base(a.restaurant.id), cookie).json({
        category_id: a.categoryId,
        name: 'X',
        price: '1.00',
        restaurant_id: b.restaurant.id,
      })
    ).assertStatus(422)
    assert.lengthOf(await db.from('products'), 0)
  })
})
