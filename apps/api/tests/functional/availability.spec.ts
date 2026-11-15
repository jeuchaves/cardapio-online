import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { authed, createRestaurantWithTeam, loginAndGetCookie, resetState } from '#tests/helpers'

const tenant = (restaurantId: string) => `/api/v1/tenant/${restaurantId}`

async function setup() {
  const team = await createRestaurantWithTeam()
  const [category] = await db
    .table('categories')
    .insert({ restaurant_id: team.restaurant.id, name: 'Lanches' })
    .returning('id')
  const [product] = await db
    .table('products')
    .insert({
      restaurant_id: team.restaurant.id,
      category_id: category.id,
      name: 'X-Burguer',
      price: '12.50',
    })
    .returning('id')
  const [addon] = await db
    .table('product_addons')
    .insert({ restaurant_id: team.restaurant.id, name: 'Bacon', price: '3.00' })
    .returning('id')
  await db.table('product_product_addons').insert({
    product_id: product.id,
    product_addon_id: addon.id,
    restaurant_id: team.restaurant.id,
  })
  return { ...team, productId: product.id as string, addonId: addon.id as string }
}

test.group('Disponibilidade | produtos e adicionais', (group) => {
  group.each.setup(resetState)

  test('owner altera a disponibilidade e as listagens refletem o estado', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, productId, addonId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const base = tenant(restaurant.id)

    const product = await authed(client, 'patch', `${base}/products/${productId}`, cookie).json({
      is_available: false,
    })
    product.assertStatus(200)
    assert.isFalse(product.body().data.is_available)

    const addon = await authed(client, 'patch', `${base}/addons/${addonId}`, cookie).json({
      is_available: false,
    })
    addon.assertStatus(200)
    assert.isFalse(addon.body().data.is_available)

    // Indisponíveis continuam na listagem do painel, com o estado visível
    const products = await authed(client, 'get', `${base}/products`, cookie)
    assert.lengthOf(products.body().data, 1)
    assert.isFalse(products.body().data[0].is_available)
    assert.isFalse(products.body().data[0].addons[0].is_available)
    const addons = await authed(client, 'get', `${base}/addons`, cookie)
    assert.isFalse(addons.body().data[0].is_available)

    // Alterar disponibilidade não mexe em preço, nome nem associação
    assert.strictEqual(products.body().data[0].price, '12.50')
    assert.strictEqual(products.body().data[0].addons[0].price, '3.00')
    assert.lengthOf(await db.from('product_product_addons'), 1)

    // E volta a ficar disponível
    ;(
      await authed(client, 'patch', `${base}/products/${productId}`, cookie).json({
        is_available: true,
      })
    ).assertStatus(200)
    ;(
      await authed(client, 'patch', `${base}/addons/${addonId}`, cookie).json({
        is_available: true,
      })
    ).assertStatus(200)
    const again = await authed(client, 'get', `${base}/products`, cookie)
    assert.isTrue(again.body().data[0].is_available)
    assert.isTrue(again.body().data[0].addons[0].is_available)
  })

  test('staff é recusado (403) mesmo com o valor igual ao atual, e nada muda', async ({
    client,
    assert,
  }) => {
    const { restaurant, staff, productId, addonId } = await setup()
    const cookie = await loginAndGetCookie(client, staff.email)
    const base = tenant(restaurant.id)

    for (const value of [true, false]) {
      ;(
        await authed(client, 'patch', `${base}/products/${productId}`, cookie).json({
          is_available: value,
        })
      ).assertStatus(403)
      ;(
        await authed(client, 'patch', `${base}/addons/${addonId}`, cookie).json({
          is_available: value,
        })
      ).assertStatus(403)
      ;(
        await authed(client, 'patch', `${base}/products/${productId}`, cookie).json({
          name: 'Outro',
          is_available: value,
        })
      ).assertStatus(403)
    }
    assert.isTrue((await db.from('products').where('id', productId).first()).is_available)
    assert.isTrue((await db.from('product_addons').where('id', addonId).first()).is_available)
    assert.equal((await db.from('products').where('id', productId).first()).name, 'X-Burguer')

    // Staff continua podendo consultar o estado
    const list = await authed(client, 'get', `${base}/products`, cookie)
    assert.isTrue(list.body().data[0].is_available)
  })

  test('valor não booleano e nulo são rejeitados (422)', async ({ client, assert }) => {
    const { restaurant, owner, productId, addonId } = await setup()
    const cookie = await loginAndGetCookie(client, owner.email)
    const base = tenant(restaurant.id)
    for (const value of ['false', 0, 1, null, 'sim']) {
      ;(
        await authed(client, 'patch', `${base}/products/${productId}`, cookie).json({
          is_available: value,
        })
      ).assertStatus(422)
      ;(
        await authed(client, 'patch', `${base}/addons/${addonId}`, cookie).json({
          is_available: value,
        })
      ).assertStatus(422)
    }
    assert.isTrue((await db.from('products').where('id', productId).first()).is_available)
  })

  test('disponibilidade de outro restaurante não é alterável (404)', async ({ client, assert }) => {
    const a = await setup()
    const b = await setup()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    for (const [resource, id] of [
      ['products', b.productId],
      ['addons', b.addonId],
    ]) {
      ;(
        await authed(client, 'patch', `${tenant(a.restaurant.id)}/${resource}/${id}`, cookie).json({
          is_available: false,
        })
      ).assertStatus(404)
      ;(
        await authed(client, 'patch', `${tenant(b.restaurant.id)}/${resource}/${id}`, cookie).json({
          is_available: false,
        })
      ).assertStatus(404)
    }
    assert.isTrue((await db.from('products').where('id', b.productId).first()).is_available)
    assert.isTrue((await db.from('product_addons').where('id', b.addonId).first()).is_available)
  })
})
