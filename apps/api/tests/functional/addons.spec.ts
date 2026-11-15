import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { authed, createRestaurantWithTeam, loginAndGetCookie, resetState } from '#tests/helpers'

const base = (restaurantId: string) => `/api/v1/tenant/${restaurantId}/addons`

async function insertAddon(
  restaurantId: string,
  name: string,
  extra: Record<string, unknown> = {}
) {
  const [row] = await db
    .table('product_addons')
    .insert({ restaurant_id: restaurantId, name, price: '2.00', ...extra })
    .returning('id')
  return row.id as string
}

test.group('Adicionais | CRUD e autorização', (group) => {
  group.each.setup(resetState)

  test('owner cria, lista ordenado, altera e exclui; preço sempre como string', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)

    const created = await authed(client, 'post', url, cookie).json({
      name: '  Queijo ',
      description: 'Muçarela',
      price: '2.5',
    })
    created.assertStatus(201)
    assert.equal(created.body().data.name, 'Queijo')
    assert.strictEqual(created.body().data.price, '2.50')
    assert.isTrue(created.body().data.is_available)
    assert.notProperty(created.body().data, 'restaurant_id')

    await authed(client, 'post', url, cookie).json({ name: 'Bacon', price: '3' })
    const list = await authed(client, 'get', url, cookie)
    list.assertStatus(200)
    assert.deepEqual(
      list.body().data.map((a: { name: string; price: string }) => [a.name, a.price]),
      [
        ['Bacon', '3.00'],
        ['Queijo', '2.50'],
      ]
    )

    const id = created.body().data.id
    const patched = await authed(client, 'patch', `${url}/${id}`, cookie).json({
      name: 'Cheddar',
      price: '0.10',
      description: null,
    })
    patched.assertStatus(200)
    assert.strictEqual(patched.body().data.price, '0.10')
    assert.isNull(patched.body().data.description)
    assert.strictEqual((await db.from('product_addons').where('id', id).first()).price, '0.10')

    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(204)
    assert.lengthOf(await db.from('product_addons').where('id', id), 0)
  })

  test('staff cria e altera, mas não envia is_available nem exclui', async ({ client, assert }) => {
    const { restaurant, staff } = await createRestaurantWithTeam()
    const id = await insertAddon(restaurant.id, 'Existente')
    const cookie = await loginAndGetCookie(client, staff.email)
    const url = base(restaurant.id)

    ;(await authed(client, 'post', url, cookie).json({ name: 'Novo', price: '1' })).assertStatus(
      201
    )
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ name: 'Renomeado' })
    ).assertStatus(200)
    ;(
      await authed(client, 'post', url, cookie).json({ name: 'Z', price: '1', is_available: true })
    ).assertStatus(403)
    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(403)
    assert.equal((await db.from('product_addons').where('id', id).first()).name, 'Renomeado')
  })

  test('validação: campos, limites de texto e preço', async ({ client, assert }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const id = await insertAddon(restaurant.id, 'Base', { price: '9.99' })
    const post = (body: object) => authed(client, 'post', url, cookie).json(body)
    const patch = (body: object) => authed(client, 'patch', `${url}/${id}`, cookie).json(body)

    ;(await post({ name: 'A', price: '1', restaurant_id: restaurant.id })).assertStatus(422)
    ;(await patch({ id })).assertStatus(422)
    for (const body of [
      {},
      { price: '1' },
      { name: 'A' },
      { name: '', price: '1' },
      { name: 'x'.repeat(81), price: '1' },
      { name: 'A', price: '1', description: 'x'.repeat(501) },
      { name: 'A', price: '1', is_available: 'sim' },
      { name: 'A', price: 1.5 },
      { name: 'A', price: 0 },
      { name: 'A', price: '-1' },
      { name: 'A', price: '1.234' },
      { name: 'A', price: '1e3' },
      { name: 'A', price: '100000000.00' },
      { name: 'A', price: '12,5' },
    ]) {
      ;(await post(body)).assertStatus(422)
    }
    for (const body of [
      {},
      { name: '' },
      { name: null },
      { price: null },
      { price: 2 },
      { price: '-1' },
    ]) {
      ;(await patch(body)).assertStatus(422)
    }
    assert.lengthOf(await db.from('product_addons'), 1)
    assert.strictEqual((await db.from('product_addons').where('id', id).first()).price, '9.99')
    ;(await post({ name: 'x'.repeat(80), price: '99999999.99' })).assertStatus(201)
  })

  test('nome duplicado no restaurante: 409; outro restaurante e outra caixa: permitido', async ({
    client,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const cookieA = await loginAndGetCookie(client, a.owner.email)
    const cookieB = await loginAndGetCookie(client, b.owner.email)
    const post = (restaurantId: string, cookie: string, name: string) =>
      authed(client, 'post', base(restaurantId), cookie).json({ name, price: '1' })

    ;(await post(a.restaurant.id, cookieA, 'Bacon')).assertStatus(201)
    const dup = await post(a.restaurant.id, cookieA, 'Bacon')
    dup.assertStatus(409)
    dup.assertBodyContains({ code: 'ADDON_NAME_TAKEN' })
    ;(await post(a.restaurant.id, cookieA, 'bacon')).assertStatus(201)
    ;(await post(b.restaurant.id, cookieB, 'Bacon')).assertStatus(201)

    const other = await post(a.restaurant.id, cookieA, 'Ovo')
    const rename = await authed(
      client,
      'patch',
      `${base(a.restaurant.id)}/${other.body().data.id}`,
      cookieA
    ).json({ name: 'Bacon' })
    rename.assertStatus(409)
    rename.assertBodyContains({ code: 'ADDON_NAME_TAKEN' })
  })

  test('excluir adicional remove só as associações; os produtos continuam', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const [category] = await db
      .table('categories')
      .insert({ restaurant_id: restaurant.id, name: 'C' })
      .returning('id')
    const [product] = await db
      .table('products')
      .insert({
        restaurant_id: restaurant.id,
        category_id: category.id,
        name: 'P',
        price: '1.00',
      })
      .returning('id')
    const addon = await insertAddon(restaurant.id, 'Bacon')
    await db.table('product_product_addons').insert({
      product_id: product.id,
      product_addon_id: addon,
      restaurant_id: restaurant.id,
    })
    const cookie = await loginAndGetCookie(client, owner.email)
    ;(await authed(client, 'delete', `${base(restaurant.id)}/${addon}`, cookie)).assertStatus(204)
    assert.lengthOf(await db.from('product_product_addons'), 0)
    assert.lengthOf(await db.from('products'), 1)
  })

  test('sem sessão: 401', async ({ client }) => {
    const { restaurant } = await createRestaurantWithTeam()
    ;(await client.get(base(restaurant.id))).assertStatus(401)
  })
})

test.group('Adicionais | isolamento entre restaurantes', (group) => {
  group.each.setup(resetState)

  test('listagem só do próprio restaurante; restaurantId de B responde 404', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    await insertAddon(a.restaurant.id, 'Do A')
    const idB = await insertAddon(b.restaurant.id, 'Do B')
    const cookie = await loginAndGetCookie(client, a.owner.email)

    const list = await authed(client, 'get', base(a.restaurant.id), cookie)
    assert.deepEqual(
      list.body().data.map((x: { name: string }) => x.name),
      ['Do A']
    )

    const url = base(b.restaurant.id)
    ;(await authed(client, 'get', url, cookie)).assertStatus(404)
    ;(await authed(client, 'post', url, cookie).json({ name: 'X', price: '1' })).assertStatus(404)
    ;(await authed(client, 'patch', `${url}/${idB}`, cookie).json({ name: 'X' })).assertStatus(404)
    ;(await authed(client, 'delete', `${url}/${idB}`, cookie)).assertStatus(404)
    assert.equal((await db.from('product_addons').where('id', idB).first()).name, 'Do B')
  })

  test('conhecendo o ID de B, alterar e excluir pelo próprio restaurante dá 404 e não muda nada', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const idB = await insertAddon(b.restaurant.id, 'Do B', { price: '4.00' })
    const url = `${base(a.restaurant.id)}/${idB}`

    for (const user of [a.owner, a.staff]) {
      const cookie = await loginAndGetCookie(client, user.email)
      ;(
        await authed(client, 'patch', url, cookie).json({ name: 'Invadido', price: '0.01' })
      ).assertStatus(404)
    }
    const ownerCookie = await loginAndGetCookie(client, a.owner.email)
    ;(await authed(client, 'patch', url, ownerCookie).json({ is_available: false })).assertStatus(
      404
    )
    ;(await authed(client, 'delete', url, ownerCookie)).assertStatus(404)
    ;(
      await authed(client, 'patch', `${base(a.restaurant.id)}/nao-e-uuid`, ownerCookie).json({
        name: 'X',
      })
    ).assertStatus(404)

    const row = await db.from('product_addons').where('id', idB).first()
    assert.equal(row.name, 'Do B')
    assert.strictEqual(row.price, '4.00')
    assert.isTrue(row.is_available)
  })

  test('restaurant_id no corpo nunca define o tenant', async ({ client, assert }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    ;(
      await authed(client, 'post', base(a.restaurant.id), cookie).json({
        name: 'X',
        price: '1',
        restaurant_id: b.restaurant.id,
      })
    ).assertStatus(422)
    assert.lengthOf(await db.from('product_addons'), 0)
  })
})
