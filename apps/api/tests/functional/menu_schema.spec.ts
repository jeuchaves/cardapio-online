import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { createRestaurant, resetState } from '#tests/helpers'

// Códigos do PostgreSQL: 23505 unique, 23514 check, 23503 foreign key,
// 22001 texto longo demais, 22003 numérico fora do intervalo
async function pgCode(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return null
}

async function restaurantWithMenu() {
  const restaurant = await createRestaurant()
  const [category] = await db
    .table('categories')
    .insert({ restaurant_id: restaurant.id, name: 'Lanches' })
    .returning('id')
  const [product] = await db
    .table('products')
    .insert({
      restaurant_id: restaurant.id,
      category_id: category.id,
      name: 'X-Burguer',
      price: '12.50',
    })
    .returning('id')
  const [addon] = await db
    .table('product_addons')
    .insert({ restaurant_id: restaurant.id, name: 'Bacon', price: '3.00' })
    .returning('id')
  return { restaurant, categoryId: category.id, productId: product.id, addonId: addon.id }
}

function associate(productId: string, addonId: string, restaurantId: string) {
  return db
    .table('product_product_addons')
    .insert({ product_id: productId, product_addon_id: addonId, restaurant_id: restaurantId })
}

test.group('Schema do cardápio | restrições', (group) => {
  group.each.setup(resetState)

  test('UNIQUE (id, restaurant_id) existe nas tabelas referenciadas', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT c.conrelid::regclass::text AS tabela,
              array_agg(a.attname::text ORDER BY a.attname)::text[] AS colunas
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'u'
          AND c.conrelid::regclass::text IN ('categories', 'products', 'product_addons')
        GROUP BY c.oid, c.conrelid`
    )
    const unique = result.rows
      .filter((row: { colunas: string[] }) => row.colunas.join() === 'id,restaurant_id')
      .map((row: { tabela: string }) => row.tabela)
      .sort()
    assert.deepEqual(unique, ['categories', 'product_addons', 'products'])
  })

  test('nome de categoria e de adicional: único por restaurante, sensível a maiúsculas (D5)', async ({
    assert,
  }) => {
    const a = await createRestaurant()
    const b = await createRestaurant()
    const category = (restaurantId: string, name: string) =>
      db.table('categories').insert({ restaurant_id: restaurantId, name })
    const addon = (restaurantId: string, name: string) =>
      db.table('product_addons').insert({ restaurant_id: restaurantId, name, price: '1.00' })

    await category(a.id, 'Pizzas')
    await addon(a.id, 'Queijo')
    assert.equal(await pgCode(() => category(a.id, 'Pizzas')), '23505')
    assert.equal(await pgCode(() => addon(a.id, 'Queijo')), '23505')
    // Outro restaurante pode repetir o nome; a caixa diferente é outro nome
    assert.isNull(await pgCode(() => category(b.id, 'Pizzas')))
    assert.isNull(await pgCode(() => addon(b.id, 'Queijo')))
    assert.isNull(await pgCode(() => category(a.id, 'pizzas')))
  })

  test('FK-01: produto não aceita categoria de outro restaurante', async ({ assert }) => {
    const a = await restaurantWithMenu()
    const b = await restaurantWithMenu()
    const product = (restaurantId: string, categoryId: string) =>
      db.table('products').insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: 'Intruso',
        price: '1.00',
      })

    assert.equal(await pgCode(() => product(a.restaurant.id, b.categoryId)), '23503')
    assert.equal(await pgCode(() => product(b.restaurant.id, a.categoryId)), '23503')
    assert.isNull(await pgCode(() => product(a.restaurant.id, a.categoryId)))

    // Também na alteração: mover o produto para a categoria do outro restaurante falha
    const code = await pgCode(() =>
      db.from('products').where('id', a.productId).update({ category_id: b.categoryId })
    )
    assert.equal(code, '23503')
  })

  test('FK-02 e FK-03: associação entre restaurantes diferentes é rejeitada pelo banco', async ({
    assert,
  }) => {
    const a = await restaurantWithMenu()
    const b = await restaurantWithMenu()
    const c = await createRestaurant()

    // Produto do A com adicional do B, nas três combinações possíveis de restaurant_id
    assert.equal(await pgCode(() => associate(a.productId, b.addonId, a.restaurant.id)), '23503')
    assert.equal(await pgCode(() => associate(a.productId, b.addonId, b.restaurant.id)), '23503')
    assert.equal(await pgCode(() => associate(a.productId, b.addonId, c.id)), '23503')
    // E o inverso
    assert.equal(await pgCode(() => associate(b.productId, a.addonId, a.restaurant.id)), '23503')

    assert.lengthOf(await db.from('product_product_addons'), 0)

    // Dentro do mesmo restaurante funciona, e o par é único
    assert.isNull(await pgCode(() => associate(a.productId, a.addonId, a.restaurant.id)))
    assert.equal(await pgCode(() => associate(a.productId, a.addonId, a.restaurant.id)), '23505')
  })

  test('CT-06: preço negativo é rejeitado; zero e duas casas são preservados como texto', async ({
    assert,
  }) => {
    const { restaurant, categoryId, productId, addonId } = await restaurantWithMenu()
    const product = (price: string) =>
      db.table('products').insert({
        restaurant_id: restaurant.id,
        category_id: categoryId,
        name: `P ${price}`,
        price,
      })
    const addon = (price: string) =>
      db.table('product_addons').insert({ restaurant_id: restaurant.id, name: `A ${price}`, price })

    assert.equal(await pgCode(() => product('-0.01')), '23514')
    assert.equal(await pgCode(() => addon('-0.01')), '23514')
    assert.equal(
      await pgCode(() => db.from('products').where('id', productId).update({ price: '-1.00' })),
      '23514'
    )
    assert.equal(await pgCode(() => product('100000000.00')), '22003')

    assert.isNull(await pgCode(() => product('0.00')))
    assert.isNull(await pgCode(() => addon('0.00')))
    assert.isNull(await pgCode(() => product('99999999.99')))

    // O driver devolve numeric como string: nenhuma conversão para number
    const stored = await db.from('products').where('id', productId).first()
    assert.strictEqual(stored.price, '12.50')
    const storedAddon = await db.from('product_addons').where('id', addonId).first()
    assert.strictEqual(storedAddon.price, '3.00')
  })

  test('limites de tamanho de texto', async ({ assert }) => {
    const { restaurant, categoryId } = await restaurantWithMenu()
    const product = (values: Record<string, unknown>) =>
      db.table('products').insert({
        restaurant_id: restaurant.id,
        category_id: categoryId,
        name: 'ok',
        price: '1.00',
        ...values,
      })
    const addon = (values: Record<string, unknown>) =>
      db
        .table('product_addons')
        .insert({ restaurant_id: restaurant.id, name: 'ok', price: '1.00', ...values })

    assert.equal(
      await pgCode(() =>
        db.table('categories').insert({ restaurant_id: restaurant.id, name: 'x'.repeat(81) })
      ),
      '22001'
    )
    assert.equal(await pgCode(() => product({ name: 'x'.repeat(121) })), '22001')
    assert.equal(await pgCode(() => product({ description: 'x'.repeat(1001) })), '22001')
    assert.equal(await pgCode(() => addon({ name: 'x'.repeat(81) })), '22001')
    assert.equal(await pgCode(() => addon({ description: 'x'.repeat(501) })), '22001')
  })

  test('excluir produto ou adicional remove só as suas associações (CASCADE)', async ({
    assert,
  }) => {
    const { restaurant, categoryId, productId, addonId } = await restaurantWithMenu()
    const [product2] = await db
      .table('products')
      .insert({
        restaurant_id: restaurant.id,
        category_id: categoryId,
        name: 'Outro',
        price: '5.00',
      })
      .returning('id')
    const [addon2] = await db
      .table('product_addons')
      .insert({ restaurant_id: restaurant.id, name: 'Ovo', price: '2.00' })
      .returning('id')
    // Matriz 2 x 2 de associações
    for (const p of [productId, product2.id]) {
      for (const ad of [addonId, addon2.id]) await associate(p, ad, restaurant.id)
    }

    await db.from('products').where('id', productId).delete()
    const afterProduct = await db.from('product_product_addons').select('product_id')
    assert.lengthOf(afterProduct, 2)
    assert.isTrue(afterProduct.every((row) => row.product_id === product2.id))
    assert.lengthOf(await db.from('product_addons'), 2)

    await db.from('product_addons').where('id', addon2.id).delete()
    const afterAddon = await db.from('product_product_addons')
    assert.lengthOf(afterAddon, 1)
    assert.equal(afterAddon[0].product_addon_id, addonId)
    assert.equal(afterAddon[0].product_id, product2.id)
    assert.lengthOf(await db.from('products'), 1)
  })

  test('RESTRICT: categoria com produto e restaurante com cardápio não são excluídos', async ({
    assert,
  }) => {
    const { restaurant, categoryId, productId } = await restaurantWithMenu()
    assert.equal(
      await pgCode(() => db.from('categories').where('id', categoryId).delete()),
      '23503'
    )
    assert.equal(
      await pgCode(() => db.from('restaurants').where('id', restaurant.id).delete()),
      '23503'
    )
    // Sem produtos, a categoria pode ser excluída
    await db.from('products').where('id', productId).delete()
    await db.from('categories').where('id', categoryId).delete()
    assert.lengthOf(await db.from('categories'), 0)
  })
})
