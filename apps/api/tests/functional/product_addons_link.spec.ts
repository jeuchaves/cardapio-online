import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  ORIGIN,
  authed,
  createRestaurantWithTeam,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'

const url = (restaurantId: string, productId: string) =>
  `/api/v1/tenant/${restaurantId}/products/${productId}/addons`

const MISSING = '11111111-1111-4111-8111-111111111111'

async function setup() {
  const { restaurant, owner, staff } = await createRestaurantWithTeam()
  const [category] = await db
    .table('categories')
    .insert({ restaurant_id: restaurant.id, name: 'Lanches' })
    .returning('id')
  const product = (name: string) => insertProduct(restaurant.id, category.id, name)
  return { restaurant, owner, staff, categoryId: category.id as string, product }
}

async function insertProduct(restaurantId: string, categoryId: string, name: string) {
  const [row] = await db
    .table('products')
    .insert({ restaurant_id: restaurantId, category_id: categoryId, name, price: '10.00' })
    .returning('id')
  return row.id as string
}

async function insertAddon(restaurantId: string, name: string, price = '2.00') {
  const [row] = await db
    .table('product_addons')
    .insert({ restaurant_id: restaurantId, name, price })
    .returning('id')
  return row.id as string
}

async function linked(productId: string) {
  const rows = await db.from('product_product_addons').where('product_id', productId)
  return rows.map((row) => row.product_addon_id as string).sort()
}

test.group('Adicionais do produto | substituição', (group) => {
  group.each.setup(resetState)

  test('owner e staff substituem o conjunto; resposta traz o produto com os adicionais', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff, product } = await setup()
    const productId = await product('X-Burguer')
    const bacon = await insertAddon(restaurant.id, 'Bacon', '3.00')
    const queijo = await insertAddon(restaurant.id, 'Queijo', '2.50')
    const ovo = await insertAddon(restaurant.id, 'Ovo')

    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const first = await authed(client, 'put', url(restaurant.id, productId), ownerCookie).json({
      addon_ids: [queijo, bacon],
    })
    first.assertStatus(200)
    assert.equal(first.body().data.id, productId)
    assert.deepEqual(
      first.body().data.addons.map((a: { name: string; price: string }) => [a.name, a.price]),
      [
        ['Bacon', '3.00'],
        ['Queijo', '2.50'],
      ]
    )
    assert.sameMembers(await linked(productId), [bacon, queijo])
    const rows = await db.from('product_product_addons')
    assert.isTrue(rows.every((row) => row.restaurant_id === restaurant.id))

    // Substitui (não acumula) e o staff também pode
    const staffCookie = await loginAndGetCookie(client, staff.email)
    ;(
      await authed(client, 'put', url(restaurant.id, productId), staffCookie).json({
        addon_ids: [ovo, bacon],
      })
    ).assertStatus(200)
    assert.sameMembers(await linked(productId), [ovo, bacon])

    // Lista vazia remove tudo; idempotente
    for (let i = 0; i < 2; i++) {
      const cleared = await authed(client, 'put', url(restaurant.id, productId), ownerCookie).json({
        addon_ids: [],
      })
      cleared.assertStatus(200)
      assert.deepEqual(cleared.body().data.addons, [])
    }
    assert.lengthOf(await db.from('product_product_addons'), 0)
    // Os adicionais continuam existindo
    assert.lengthOf(await db.from('product_addons'), 3)
  })

  test('só altera o produto indicado', async ({ client, assert }) => {
    const { restaurant, owner, product } = await setup()
    const p1 = await product('P1')
    const p2 = await product('P2')
    const addon = await insertAddon(restaurant.id, 'Bacon')
    const cookie = await loginAndGetCookie(client, owner.email)
    await authed(client, 'put', url(restaurant.id, p1), cookie).json({ addon_ids: [addon] })
    await authed(client, 'put', url(restaurant.id, p2), cookie).json({ addon_ids: [addon] })
    await authed(client, 'put', url(restaurant.id, p1), cookie).json({ addon_ids: [] })
    assert.deepEqual(await linked(p1), [])
    assert.deepEqual(await linked(p2), [addon])
  })

  test('validação: corpo, tipos, duplicados e limite de 10', async ({ client, assert }) => {
    const { restaurant, owner, product } = await setup()
    const productId = await product('P')
    const addon = await insertAddon(restaurant.id, 'Bacon')
    const keep = await insertAddon(restaurant.id, 'Queijo')
    const cookie = await loginAndGetCookie(client, owner.email)
    const put = (body: unknown) =>
      authed(client, 'put', url(restaurant.id, productId), cookie).json(body as object)
    await put({ addon_ids: [keep] })

    const eleven = Array.from(
      { length: 11 },
      (_, i) => `00000000-0000-4000-8000-0000000000${10 + i}`
    )
    for (const body of [
      {},
      { addon_ids: null },
      { addon_ids: addon },
      { addon_ids: [1] },
      { addon_ids: ['abc'] },
      { addon_ids: [addon, addon] },
      { addon_ids: [addon, addon.toUpperCase()] },
      { addon_ids: eleven },
      { addon_ids: [addon], restaurant_id: restaurant.id },
      { addon_ids: [addon], product_id: productId },
    ]) {
      ;(await put(body)).assertStatus(422)
    }
    // Nenhuma das tentativas inválidas mexeu nas associações
    assert.deepEqual(await linked(productId), [keep])

    // Exatamente 10 é aceito
    const ten: string[] = []
    for (let i = 0; i < 10; i++) ten.push(await insertAddon(restaurant.id, `Extra ${i}`))
    ;(await put({ addon_ids: ten })).assertStatus(200)
    assert.sameMembers(await linked(productId), ten)
  })

  test('autorização: sem sessão 401; produto inexistente ou malformado 404', async ({ client }) => {
    const { restaurant, owner } = await setup()
    ;(
      await client.put(url(restaurant.id, MISSING)).header('Origin', ORIGIN).json({ addon_ids: [] })
    ).assertStatus(401)
    // Sem Origin, a escrita é recusada antes mesmo da autenticação (CSRF)
    ;(await client.put(url(restaurant.id, MISSING)).json({ addon_ids: [] })).assertStatus(403)
    const cookie = await loginAndGetCookie(client, owner.email)
    ;(
      await authed(client, 'put', url(restaurant.id, MISSING), cookie).json({ addon_ids: [] })
    ).assertStatus(404)
    ;(
      await authed(client, 'put', url(restaurant.id, 'nao-e-uuid'), cookie).json({ addon_ids: [] })
    ).assertStatus(404)
  })
})

test.group('Adicionais do produto | isolamento e atomicidade', (group) => {
  group.each.setup(resetState)

  test('adicional de outro restaurante é recusado como se não existisse e nada muda', async ({
    client,
    assert,
  }) => {
    const a = await setup()
    const b = await setup()
    const productA = await a.product('Do A')
    const ownAddon = await insertAddon(a.restaurant.id, 'Do A')
    const foreignAddon = await insertAddon(b.restaurant.id, 'Do B')
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const put = (addonIds: string[]) =>
      authed(client, 'put', url(a.restaurant.id, productA), cookie).json({ addon_ids: addonIds })

    ;(await put([ownAddon])).assertStatus(200)

    const mixed = await put([ownAddon, foreignAddon])
    mixed.assertStatus(422)
    const missing = await put([ownAddon, MISSING])
    missing.assertStatus(422)
    // Mesma resposta para inexistente e de outro tenant
    assert.deepEqual(mixed.body(), missing.body())
    ;(await put([foreignAddon])).assertStatus(422)

    // Validou tudo antes de apagar: a associação anterior segue intacta
    assert.deepEqual(await linked(productA), [ownAddon])
    assert.lengthOf(await db.from('product_product_addons'), 1)
  })

  test('produto de outro restaurante: 404 pelo próprio restaurante e pelo restaurantId de B', async ({
    client,
    assert,
  }) => {
    const a = await setup()
    const b = await setup()
    const productB = await b.product('Do B')
    const addonA = await insertAddon(a.restaurant.id, 'Do A')
    const addonB = await insertAddon(b.restaurant.id, 'Do B')
    await db.table('product_product_addons').insert({
      product_id: productB,
      product_addon_id: addonB,
      restaurant_id: b.restaurant.id,
    })
    const cookie = await loginAndGetCookie(client, a.owner.email)

    for (const addonIds of [[], [addonA], [addonB]]) {
      ;(
        await authed(client, 'put', url(a.restaurant.id, productB), cookie).json({
          addon_ids: addonIds,
        })
      ).assertStatus(404)
      ;(
        await authed(client, 'put', url(b.restaurant.id, productB), cookie).json({
          addon_ids: addonIds,
        })
      ).assertStatus(404)
    }
    assert.deepEqual(await linked(productB), [addonB])
  })

  test('falha no meio da gravação desfaz tudo (rollback)', async ({ client, assert }) => {
    const { restaurant, owner, product } = await setup()
    const productId = await product('P')
    const keep = await insertAddon(restaurant.id, 'Antigo')
    const next = await insertAddon(restaurant.id, 'Novo')
    const cookie = await loginAndGetCookie(client, owner.email)
    ;(
      await authed(client, 'put', url(restaurant.id, productId), cookie).json({ addon_ids: [keep] })
    ).assertStatus(200)

    // Gatilho temporário: a inserção falha depois que as associações antigas já foram apagadas
    await db.rawQuery(`
      CREATE FUNCTION test_fail_link() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falha simulada'; END;
      $$ LANGUAGE plpgsql`)
    await db.rawQuery(`
      CREATE TRIGGER test_fail_link BEFORE INSERT ON product_product_addons
      FOR EACH ROW EXECUTE FUNCTION test_fail_link()`)
    try {
      const failed = await authed(client, 'put', url(restaurant.id, productId), cookie).json({
        addon_ids: [next],
      })
      failed.assertStatus(500)
      assert.notInclude(JSON.stringify(failed.body()), 'falha simulada')
    } finally {
      await db.rawQuery('DROP TRIGGER test_fail_link ON product_product_addons')
      await db.rawQuery('DROP FUNCTION test_fail_link()')
    }
    assert.deepEqual(await linked(productId), [keep])
  })

  test('substituições concorrentes do mesmo produto deixam exatamente um dos conjuntos', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, product } = await setup()
    const productId = await product('P')
    const a1 = await insertAddon(restaurant.id, 'A1')
    const a2 = await insertAddon(restaurant.id, 'A2')
    const b1 = await insertAddon(restaurant.id, 'B1')
    const b2 = await insertAddon(restaurant.id, 'B2')
    const cookie = await loginAndGetCookie(client, owner.email)

    for (let i = 0; i < 5; i++) {
      const responses = await Promise.all([
        authed(client, 'put', url(restaurant.id, productId), cookie).json({ addon_ids: [a1, a2] }),
        authed(client, 'put', url(restaurant.id, productId), cookie).json({ addon_ids: [b1, b2] }),
      ])
      for (const response of responses) response.assertStatus(200)
      const final = await linked(productId)
      assert.isTrue(
        JSON.stringify(final) === JSON.stringify([a1, a2].sort()) ||
          JSON.stringify(final) === JSON.stringify([b1, b2].sort()),
        `conjunto misturado: ${final.join(',')}`
      )
    }
  })

  test('exclusão concorrente de adicional nunca dá 500 nem associação órfã', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, product } = await setup()
    const productId = await product('P')
    const cookie = await loginAndGetCookie(client, owner.email)

    for (let i = 0; i < 5; i++) {
      const keep = await insertAddon(restaurant.id, `Fica ${i}`)
      const doomed = await insertAddon(restaurant.id, `Sai ${i}`)
      const [response] = await Promise.all([
        authed(client, 'put', url(restaurant.id, productId), cookie).json({
          addon_ids: [keep, doomed],
        }),
        db.from('product_addons').where('id', doomed).delete(),
      ])
      assert.include([200, 422], response.status())
      const final = await linked(productId)
      if (response.status() === 422) assert.notInclude(final, doomed)
      // Nunca sobra associação para adicional que não existe mais
      const orphans = await db
        .from('product_product_addons as l')
        .leftJoin('product_addons as a', 'a.id', 'l.product_addon_id')
        .whereNull('a.id')
      assert.lengthOf(orphans, 0)
    }
  })

  test('excluir o produto remove as associações, mas não os adicionais', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, product } = await setup()
    const productId = await product('P')
    const addon = await insertAddon(restaurant.id, 'Bacon')
    const cookie = await loginAndGetCookie(client, owner.email)
    await authed(client, 'put', url(restaurant.id, productId), cookie).json({ addon_ids: [addon] })
    ;(
      await authed(
        client,
        'delete',
        `/api/v1/tenant/${restaurant.id}/products/${productId}`,
        cookie
      )
    ).assertStatus(204)
    assert.lengthOf(await db.from('product_product_addons'), 0)
    assert.lengthOf(await db.from('product_addons'), 1)
  })
})
