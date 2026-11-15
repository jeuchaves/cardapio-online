import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { authed, createRestaurantWithTeam, loginAndGetCookie, resetState } from '#tests/helpers'

const base = (restaurantId: string) => `/api/v1/tenant/${restaurantId}/categories`

async function team() {
  const { restaurant, owner, staff } = await createRestaurantWithTeam()
  return { restaurant, owner, staff }
}

async function insertCategory(restaurantId: string, name: string, extra = {}) {
  const [row] = await db
    .table('categories')
    .insert({ restaurant_id: restaurantId, name, ...extra })
    .returning('id')
  return row.id as string
}

async function insertProduct(restaurantId: string, categoryId: string) {
  await db.table('products').insert({
    restaurant_id: restaurantId,
    category_id: categoryId,
    name: 'X-Burguer',
    price: '12.50',
  })
}

test.group('Categorias | CRUD', (group) => {
  group.each.setup(resetState)

  test('owner cria, lista ordenado, altera e exclui', async ({ client, assert }) => {
    const { restaurant, owner } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)

    const created = await authed(client, 'post', url, cookie).json({
      name: '  Lanches ',
      description: 'Os da casa',
      sort_order: 2,
    })
    created.assertStatus(201)
    assert.equal(created.body().data.name, 'Lanches')
    assert.isTrue(created.body().data.is_active)
    assert.notProperty(created.body().data, 'restaurant_id')

    await authed(client, 'post', url, cookie).json({ name: 'Bebidas', sort_order: 1 })
    await authed(client, 'post', url, cookie).json({ name: 'Acompanhamentos', sort_order: 1 })

    const list = await authed(client, 'get', url, cookie)
    list.assertStatus(200)
    assert.deepEqual(
      list.body().data.map((c: { name: string }) => c.name),
      ['Acompanhamentos', 'Bebidas', 'Lanches']
    )

    const id = created.body().data.id
    const updated = await authed(client, 'patch', `${url}/${id}`, cookie).json({
      name: 'Hambúrgueres',
      description: null,
      is_active: false,
      sort_order: 0,
    })
    updated.assertStatus(200)
    assert.equal(updated.body().data.name, 'Hambúrgueres')
    assert.isNull(updated.body().data.description)
    assert.isFalse(updated.body().data.is_active)
    assert.equal(updated.body().data.sort_order, 0)

    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(204)
    assert.lengthOf(await db.from('categories').where('id', id), 0)
  })

  test('staff cria, lista e altera nome, descrição e ordem', async ({ client, assert }) => {
    const { restaurant, staff } = await team()
    const cookie = await loginAndGetCookie(client, staff.email)
    const url = base(restaurant.id)

    const created = await authed(client, 'post', url, cookie).json({ name: 'Sobremesas' })
    created.assertStatus(201)
    assert.isTrue(created.body().data.is_active)
    assert.equal(created.body().data.sort_order, 0)

    const patched = await authed(client, 'patch', `${url}/${created.body().data.id}`, cookie).json({
      name: 'Doces',
      sort_order: 5,
    })
    patched.assertStatus(200)
    assert.equal(patched.body().data.name, 'Doces')
    ;(await authed(client, 'get', url, cookie)).assertStatus(200)
  })

  test('staff não altera is_active nem exclui, mesmo com valor igual ao atual', async ({
    client,
    assert,
  }) => {
    const { restaurant, staff } = await team()
    const id = await insertCategory(restaurant.id, 'Pratos')
    const cookie = await loginAndGetCookie(client, staff.email)
    const url = base(restaurant.id)

    ;(await authed(client, 'patch', `${url}/${id}`, cookie).json({ is_active: true })).assertStatus(
      403
    )
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ name: 'Novo', is_active: true })
    ).assertStatus(403)
    ;(
      await authed(client, 'post', url, cookie).json({ name: 'Outra', is_active: true })
    ).assertStatus(403)
    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(403)

    const row = await db.from('categories').where('id', id).first()
    assert.equal(row.name, 'Pratos')
    assert.lengthOf(await db.from('categories'), 1)
  })

  test('sem sessão: 401; sem Origin em escrita: recusado', async ({ client }) => {
    const { restaurant, owner } = await team()
    ;(await client.get(base(restaurant.id))).assertStatus(401)
    const cookie = await loginAndGetCookie(client, owner.email)
    const response = await client.post(base(restaurant.id)).header('Cookie', cookie).json({
      name: 'X',
    })
    response.assertStatus(403)
  })

  test('validação: campos desconhecidos, vazios, tipos e limites', async ({ client, assert }) => {
    const { restaurant, owner } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const id = await insertCategory(restaurant.id, 'Base')

    const post = (body: object) => authed(client, 'post', url, cookie).json(body)
    const patch = (body: object) => authed(client, 'patch', `${url}/${id}`, cookie).json(body)

    const unknown = await post({ name: 'A', restaurant_id: restaurant.id, id })
    unknown.assertStatus(422)
    assert.sameMembers(
      unknown.body().details.map((d: { field: string }) => d.field),
      ['restaurant_id', 'id']
    )
    ;(await patch({ created_at: '2020-01-01' })).assertStatus(422)

    for (const body of [
      {},
      { name: '' },
      { name: '   ' },
      { name: 'x'.repeat(81) },
      { name: 'ok', description: 'x'.repeat(501) },
      { name: 'ok', sort_order: -1 },
      { name: 'ok', sort_order: 10000 },
      { name: 'ok', sort_order: 1.5 },
      { name: 'ok', is_active: 'sim' },
    ]) {
      ;(await post(body)).assertStatus(422)
    }
    for (const body of [
      {},
      { name: '' },
      { name: null },
      { sort_order: null },
      { is_active: null },
      { sort_order: 10000 },
    ]) {
      ;(await patch(body)).assertStatus(422)
    }
    assert.lengthOf(await db.from('categories'), 1)
    ;(await post({ name: 'x'.repeat(80), sort_order: 9999 })).assertStatus(201)
  })

  test('nome duplicado no restaurante: 409; em outro restaurante e com outra caixa: permitido', async ({
    client,
  }) => {
    const a = await team()
    const b = await team()
    const cookieA = await loginAndGetCookie(client, a.owner.email)
    const cookieB = await loginAndGetCookie(client, b.owner.email)

    ;(
      await authed(client, 'post', base(a.restaurant.id), cookieA).json({ name: 'Pizzas' })
    ).assertStatus(201)
    const dup = await authed(client, 'post', base(a.restaurant.id), cookieA).json({
      name: 'Pizzas',
    })
    dup.assertStatus(409)
    dup.assertBodyContains({ code: 'CATEGORY_NAME_TAKEN' })
    ;(
      await authed(client, 'post', base(a.restaurant.id), cookieA).json({ name: 'pizzas' })
    ).assertStatus(201)
    ;(
      await authed(client, 'post', base(b.restaurant.id), cookieB).json({ name: 'Pizzas' })
    ).assertStatus(201)

    const other = await authed(client, 'post', base(a.restaurant.id), cookieA).json({
      name: 'Massas',
    })
    const rename = await authed(
      client,
      'patch',
      `${base(a.restaurant.id)}/${other.body().data.id}`,
      cookieA
    ).json({ name: 'Pizzas' })
    rename.assertStatus(409)
    rename.assertBodyContains({ code: 'CATEGORY_NAME_TAKEN' })
  })

  test('categoria com produtos não é excluída (409); sem produtos, sim', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const id = await insertCategory(restaurant.id, 'Lanches')
    await insertProduct(restaurant.id, id)

    const blocked = await authed(client, 'delete', `${url}/${id}`, cookie)
    blocked.assertStatus(409)
    blocked.assertBodyContains({ code: 'CATEGORY_HAS_PRODUCTS' })
    assert.lengthOf(await db.from('categories').where('id', id), 1)

    await db.from('products').delete()
    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(204)
  })

  test('exclusão em corrida com a criação de um produto nunca dá 500', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await team()
    const cookie = await loginAndGetCookie(client, owner.email)

    for (let i = 0; i < 5; i++) {
      const id = await insertCategory(restaurant.id, `Corrida ${i}`)
      const [response] = await Promise.all([
        authed(client, 'delete', `${base(restaurant.id)}/${id}`, cookie),
        insertProduct(restaurant.id, id).catch(() => null),
      ])
      assert.include([204, 409], response.status())
      const category = await db.from('categories').where('id', id).first()
      const products = await db.from('products').where('category_id', id)
      // Nunca produto órfão: ou a categoria existe, ou não há produto nela
      assert.isTrue(category !== null || products.length === 0)
    }
  })
})

test.group('Categorias | isolamento entre restaurantes', (group) => {
  group.each.setup(resetState)

  test('listagem mostra só as categorias do próprio restaurante', async ({ client, assert }) => {
    const a = await team()
    const b = await team()
    await insertCategory(a.restaurant.id, 'Do A')
    await insertCategory(b.restaurant.id, 'Do B')
    const cookie = await loginAndGetCookie(client, a.owner.email)

    const list = await authed(client, 'get', base(a.restaurant.id), cookie)
    assert.deepEqual(
      list.body().data.map((c: { name: string }) => c.name),
      ['Do A']
    )
  })

  test('usuário do A não acessa o restaurante B pelo restaurantId (404)', async ({
    client,
    assert,
  }) => {
    const a = await team()
    const b = await team()
    const idB = await insertCategory(b.restaurant.id, 'Do B')
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const url = base(b.restaurant.id)

    ;(await authed(client, 'get', url, cookie)).assertStatus(404)
    ;(await authed(client, 'post', url, cookie).json({ name: 'Intruso' })).assertStatus(404)
    ;(await authed(client, 'patch', `${url}/${idB}`, cookie).json({ name: 'X' })).assertStatus(404)
    ;(await authed(client, 'delete', `${url}/${idB}`, cookie)).assertStatus(404)

    const row = await db.from('categories').where('id', idB).first()
    assert.equal(row.name, 'Do B')
    assert.lengthOf(await db.from('categories'), 1)
  })

  test('conhecendo o ID de B, alterar e excluir pelo próprio restaurante dá 404 e não muda nada', async ({
    client,
    assert,
  }) => {
    const a = await team()
    const b = await team()
    const idB = await insertCategory(b.restaurant.id, 'Do B', { sort_order: 3 })
    for (const user of [a.owner, a.staff]) {
      const cookie = await loginAndGetCookie(client, user.email)
      const url = `${base(a.restaurant.id)}/${idB}`

      ;(
        await authed(client, 'patch', url, cookie).json({ name: 'Invadida', sort_order: 9 })
      ).assertStatus(404)
      ;(await authed(client, 'patch', url, cookie).json({ name: 'Invadida' })).assertStatus(404)
    }
    const ownerCookie = await loginAndGetCookie(client, a.owner.email)
    ;(await authed(client, 'delete', `${base(a.restaurant.id)}/${idB}`, ownerCookie)).assertStatus(
      404
    )
    ;(
      await authed(client, 'patch', `${base(a.restaurant.id)}/nao-e-uuid`, ownerCookie).json({
        name: 'X',
      })
    ).assertStatus(404)

    const row = await db.from('categories').where('id', idB).first()
    assert.equal(row.name, 'Do B')
    assert.equal(row.sort_order, 3)
  })

  test('restaurant_id no corpo nunca define o tenant', async ({ client, assert }) => {
    const a = await team()
    const b = await team()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    ;(
      await authed(client, 'post', base(a.restaurant.id), cookie).json({
        name: 'X',
        restaurant_id: b.restaurant.id,
      })
    ).assertStatus(422)
    assert.lengthOf(await db.from('categories'), 0)
  })
})
