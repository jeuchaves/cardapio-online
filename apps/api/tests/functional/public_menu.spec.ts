import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  authed,
  createRestaurant,
  createRestaurantWithTeam,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'

// F4-T1: GET /public/restaurants/:slug. Sem sessão; só dados públicos (ADR 0002, teste 16).

const url = (slug: string) => `/api/v1/public/restaurants/${slug}`

async function category(restaurantId: string, name: string, extra: object = {}) {
  const [row] = await db
    .table('categories')
    .insert({ restaurant_id: restaurantId, name, ...extra })
    .returning('id')
  return row.id as string
}

async function product(restaurantId: string, categoryId: string, name: string, extra = {}) {
  const [row] = await db
    .table('products')
    .insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name,
      price: '12.50',
      ...extra,
    })
    .returning('id')
  return row.id as string
}

async function addon(restaurantId: string, name: string, extra = {}) {
  const [row] = await db
    .table('product_addons')
    .insert({ restaurant_id: restaurantId, name, price: '3.00', ...extra })
    .returning('id')
  return row.id as string
}

async function attach(restaurantId: string, productId: string, addonId: string) {
  await db
    .table('product_product_addons')
    .insert({ restaurant_id: restaurantId, product_id: productId, product_addon_id: addonId })
}

test.group('Cardápio público | conteúdo', (group) => {
  group.each.setup(resetState)

  test('devolve restaurante, categorias, produtos e adicionais disponíveis, em ordem, com preço decimal em string', async ({
    client,
    assert,
  }) => {
    const restaurant = await createRestaurant({ slug: 'casa-do-chef' })
    await db
      .from('restaurants')
      .where('id', restaurant.id)
      .update({ description: 'Comida caseira', phone: '11999990000' })
    const bebidas = await category(restaurant.id, 'Bebidas', { sort_order: 2 })
    const lanches = await category(restaurant.id, 'Lanches', { sort_order: 1 })
    const burger = await product(restaurant.id, lanches, 'Burger', { sort_order: 1 })
    await product(restaurant.id, lanches, 'Anel de cebola', { sort_order: 2, price: '8.00' })
    await product(restaurant.id, bebidas, 'Suco')
    const bacon = await addon(restaurant.id, 'Bacon')
    const queijo = await addon(restaurant.id, 'Queijo')
    await attach(restaurant.id, burger, queijo)
    await attach(restaurant.id, burger, bacon)

    const response = await client.get(url('casa-do-chef'))
    response.assertStatus(200)
    const { restaurant: info, categories } = response.body().data
    assert.equal(info.name, restaurant.name)
    assert.equal(info.slug, 'casa-do-chef')
    assert.equal(info.description, 'Comida caseira')
    assert.equal(info.phone, '11999990000')
    assert.deepEqual(
      categories.map((c: { name: string }) => c.name),
      ['Lanches', 'Bebidas']
    )
    assert.deepEqual(
      categories[0].products.map((p: { name: string }) => p.name),
      ['Burger', 'Anel de cebola']
    )
    assert.strictEqual(categories[0].products[0].price, '12.50')
    assert.deepEqual(
      categories[0].products[0].addons.map((a: { name: string }) => a.name),
      ['Bacon', 'Queijo']
    )
    assert.strictEqual(categories[0].products[0].addons[0].price, '3.00')
    assert.deepEqual(categories[0].products[1].addons, [])
  })

  test('itens indisponíveis, categorias inativas e categorias vazias não aparecem', async ({
    client,
    assert,
  }) => {
    const restaurant = await createRestaurant({ slug: 'filtrado' })
    const ativa = await category(restaurant.id, 'Ativa')
    const inativa = await category(restaurant.id, 'Inativa', { is_active: false })
    const vazia = await category(restaurant.id, 'Só indisponíveis')
    const ok = await product(restaurant.id, ativa, 'Disponível')
    await product(restaurant.id, ativa, 'Indisponível', { is_available: false })
    await product(restaurant.id, inativa, 'Em categoria inativa')
    await product(restaurant.id, vazia, 'Esgotado', { is_available: false })
    const bom = await addon(restaurant.id, 'Disponível')
    const ruim = await addon(restaurant.id, 'Indisponível', { is_available: false })
    await attach(restaurant.id, ok, bom)
    await attach(restaurant.id, ok, ruim)

    const response = await client.get(url('filtrado'))
    response.assertStatus(200)
    const { categories } = response.body().data
    assert.lengthOf(categories, 1)
    assert.equal(categories[0].name, 'Ativa')
    assert.deepEqual(
      categories[0].products.map((p: { name: string }) => p.name),
      ['Disponível']
    )
    assert.deepEqual(
      categories[0].products[0].addons.map((a: { name: string }) => a.name),
      ['Disponível']
    )
    const text = JSON.stringify(response.body())
    for (const hidden of ['Indisponível', 'Em categoria inativa', 'Esgotado', 'Inativa']) {
      assert.notInclude(text, hidden)
    }
  })

  test('modalidades e métodos: só os habilitados aparecem', async ({ client, assert }) => {
    const restaurant = await createRestaurant({ slug: 'opcoes' })
    await db
      .from('restaurants')
      .where('id', restaurant.id)
      .update({ accepts_dine_in: false, accepts_cash: false, accepts_pix: false })

    const response = await client.get(url('opcoes'))
    const { restaurant: info } = response.body().data
    assert.deepEqual(info.fulfillment_modes, ['pickup'])
    assert.deepEqual(info.payment_methods, ['card'])

    await db
      .from('restaurants')
      .where('id', restaurant.id)
      .update({ accepts_dine_in: true, accepts_cash: true, accepts_pix: true })
    const all = (await client.get(url('opcoes'))).body().data.restaurant
    assert.deepEqual(all.fulfillment_modes, ['dine_in', 'pickup'])
    assert.deepEqual(all.payment_methods, ['cash', 'card', 'pix'])
  })

  test('restaurante sem itens devolve a lista de categorias vazia', async ({ client, assert }) => {
    await createRestaurant({ slug: 'vazio' })
    const response = await client.get(url('vazio'))
    response.assertStatus(200)
    assert.deepEqual(response.body().data.categories, [])
  })

  test('a resposta traz só campos públicos: sem ids de restaurante, estados internos, datas, ordem nem chaves de imagem', async ({
    client,
    assert,
  }) => {
    const { restaurant } = await createRestaurantWithTeam()
    await db
      .from('restaurants')
      .where('id', restaurant.id)
      .update({ logo: `restaurants/${restaurant.id}/logo/${crypto.randomUUID()}.png` })
    const c = await category(restaurant.id, 'Lanches')
    const p = await product(restaurant.id, c, 'Burger', {
      image: `restaurants/${restaurant.id}/products/${crypto.randomUUID()}.png`,
    })
    await attach(restaurant.id, p, await addon(restaurant.id, 'Bacon'))

    const body = (await client.get(url(restaurant.slug))).body()
    const text = JSON.stringify(body)
    // As URLs públicas de imagem (ADR 0003) têm o id no caminho; fora delas o id não aparece
    assert.notInclude(text.replace(/"\/uploads\/[^"]+"/g, '""'), restaurant.id)
    for (const forbidden of [
      'restaurant_id',
      'is_active',
      'is_available',
      'sort_order',
      'created_at',
      'updated_at',
      'category_id',
      'accepts_',
      '@exemplo.com',
    ]) {
      assert.notInclude(text, forbidden)
    }
    const { restaurant: info, categories } = body.data
    assert.sameMembers(Object.keys(info), [
      'name',
      'slug',
      'description',
      'phone',
      'logo_url',
      'fulfillment_modes',
      'payment_methods',
    ])
    assert.sameMembers(Object.keys(categories[0]), ['id', 'name', 'description', 'products'])
    assert.sameMembers(Object.keys(categories[0].products[0]), [
      'id',
      'name',
      'description',
      'price',
      'image_url',
      'addons',
    ])
    assert.sameMembers(Object.keys(categories[0].products[0].addons[0]), [
      'id',
      'name',
      'description',
      'price',
    ])
    // Imagens saem como URL pública, nunca como a chave de armazenamento
    assert.match(info.logo_url, /^\/uploads\/restaurants\//)
    assert.match(categories[0].products[0].image_url, /^\/uploads\/restaurants\//)
  })
})

test.group('Cardápio público | acesso', (group) => {
  group.each.setup(resetState)

  test('slug inexistente, mal formado ou restaurante inativo respondem o mesmo 404', async ({
    client,
    assert,
  }) => {
    const inativo = await createRestaurant({ slug: 'fechado' })
    await db.from('restaurants').where('id', inativo.id).update({ is_active: false })
    await createRestaurant({ slug: 'aberto' })

    const bodies = new Set<string>()
    for (const slug of [
      'fechado',
      'nao-existe',
      'ABERTO',
      'aberto-',
      'a'.repeat(61),
      '%20',
      'a..b',
      "x'%20OR%201=1",
    ]) {
      const response = await client.get(url(slug))
      response.assertStatus(404)
      bodies.add(JSON.stringify(response.body()))
    }
    assert.lengthOf([...bodies], 1)
    assert.equal(JSON.parse([...bodies][0]).code, 'NOT_FOUND')
  })

  test('desativar o restaurante tira o cardápio do ar e reativar o devolve', async ({ client }) => {
    const restaurant = await createRestaurant({ slug: 'liga-desliga' })
    ;(await client.get(url('liga-desliga'))).assertStatus(200)
    await db.from('restaurants').where('id', restaurant.id).update({ is_active: false })
    ;(await client.get(url('liga-desliga'))).assertStatus(404)
    await db.from('restaurants').where('id', restaurant.id).update({ is_active: true })
    ;(await client.get(url('liga-desliga'))).assertStatus(200)
  })

  test('só aceita GET: escrita no endpoint público não existe', async ({ client }) => {
    await createRestaurant({ slug: 'somente-leitura' })
    ;(await client.post(url('somente-leitura')).json({})).assertStatus(404)
    ;(await client.patch(url('somente-leitura')).json({})).assertStatus(404)
    ;(await client.delete(url('somente-leitura'))).assertStatus(404)
  })

  test('ADR 0002 teste 16: cookie de sessão válido é ignorado, a resposta é idêntica e nenhuma sessão é criada ou tocada', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const c = await category(restaurant.id, 'Lanches')
    await product(restaurant.id, c, 'Burger')
    const cookie = await loginAndGetCookie(client, owner.email)
    const sessionsBefore = JSON.stringify(await db.from('sessions').orderBy('id'))

    const anonymous = await client.get(url(restaurant.slug))
    const withSession = await authed(client, 'get', url(restaurant.slug), cookie)
    anonymous.assertStatus(200)
    withSession.assertStatus(200)
    assert.deepEqual(withSession.body(), anonymous.body())
    // Nenhuma das respostas define ou renova cookie
    assert.notProperty(anonymous.headers(), 'set-cookie')
    assert.notProperty(withSession.headers(), 'set-cookie')
    assert.equal(JSON.stringify(await db.from('sessions').orderBy('id')), sessionsBefore)

    // Cookie inválido ou de sessão encerrada também não muda nada
    const garbage = await client
      .get(url(restaurant.slug))
      .header('Cookie', 'cardapio_session=lixo')
      .header('Origin', 'http://evil.example')
    garbage.assertStatus(200)
    assert.deepEqual(garbage.body(), anonymous.body())

    // Nem o cookie de um usuário sem vínculo com o restaurante altera o resultado
    const outro = await createRestaurantWithTeam()
    const outroCookie = await loginAndGetCookie(client, outro.owner.email)
    const crossed = await authed(client, 'get', url(restaurant.slug), outroCookie)
    assert.deepEqual(crossed.body(), anonymous.body())
  })
})

test.group('Cardápio público | isolamento', (group) => {
  group.each.setup(resetState)

  test('o cardápio de A nunca contém dados de B, nem adicionais de B ligados a produtos de A', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurant({ slug: 'restaurante-a' })
    const b = await createRestaurant({ slug: 'restaurante-b' })
    const ca = await category(a.id, 'Categoria A')
    const cb = await category(b.id, 'Categoria B')
    const pa = await product(a.id, ca, 'Produto A')
    await product(b.id, cb, 'Produto B')
    await attach(a.id, pa, await addon(a.id, 'Adicional A'))
    await addon(b.id, 'Adicional B')

    const bodyA = JSON.stringify((await client.get(url('restaurante-a'))).body())
    assert.include(bodyA, 'Produto A')
    assert.include(bodyA, 'Adicional A')
    for (const alheio of ['Categoria B', 'Produto B', 'Adicional B', b.name]) {
      assert.notInclude(bodyA, alheio)
    }
    const bodyB = JSON.stringify((await client.get(url('restaurante-b'))).body())
    assert.notInclude(bodyB, 'Produto A')
    assert.notInclude(bodyB, 'Adicional A')
  })

  test('toda consulta de cardápio filtra por restaurant_id do restaurante do slug', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurant({ slug: 'restaurante-a' })
    const b = await createRestaurant({ slug: 'restaurante-b' })
    const ca = await category(a.id, 'Categoria A')
    await attach(a.id, await product(a.id, ca, 'Produto A'), await addon(a.id, 'Adicional A'))
    await category(b.id, 'Categoria B')

    const queries: { sql: string; bindings: unknown[] }[] = []
    const knex = db.connection().getWriteClient()
    const listener = (q: { sql: string; bindings?: unknown[] }) =>
      queries.push({ sql: q.sql, bindings: q.bindings ?? [] })
    knex.on('query', listener)
    ;(await client.get(url('restaurante-a'))).assertStatus(200)
    knex.off('query', listener)

    const menu = queries.filter((q) => /"(categories|products|product_addons)"/.test(q.sql))
    assert.lengthOf(menu, 3)
    for (const query of menu) {
      assert.include(query.sql, 'restaurant_id')
      assert.include(query.bindings, a.id)
      assert.notInclude(query.bindings, b.id)
    }
  })
})

// ROADMAP 8.4: ?mesa= devolve o nome da mesa só quando ela vale; nunca é erro nem oráculo.
test.group('Cardápio público | ?mesa=', (group) => {
  group.each.setup(resetState)

  async function table(restaurantId: string, identifier: string, name: string, extra = {}) {
    await db
      .table('restaurant_tables')
      .insert({ restaurant_id: restaurantId, identifier, name, ...extra })
  }

  test('mesa ativa do restaurante: devolve só o nome, o resto da resposta não muda', async ({
    client,
    assert,
  }) => {
    const restaurant = await createRestaurant({ slug: 'com-mesa' })
    await product(restaurant.id, await category(restaurant.id, 'Lanches'), 'Burger')
    await table(restaurant.id, 'abcde12345', 'Mesa 5')

    const without = await client.get(url('com-mesa'))
    const withTable = await client.get(`${url('com-mesa')}?mesa=abcde12345`)
    withTable.assertStatus(200)
    assert.deepEqual(withTable.body().data.table, { name: 'Mesa 5' })
    assert.notProperty(without.body().data, 'table')
    const rest = { ...withTable.body().data }
    delete rest.table
    assert.deepEqual(rest, without.body().data)
    assert.notInclude(JSON.stringify(withTable.body()), 'abcde12345')
  })

  test('sem o parâmetro ou com valor inválido: 200 sem table', async ({ client, assert }) => {
    const restaurant = await createRestaurant({ slug: 'com-mesa' })
    await table(restaurant.id, 'abcde12345', 'Mesa 5')

    const invalid = [
      '',
      '?mesa=',
      '?mesa=abc',
      '?mesa=ABCDE12345',
      '?mesa=abcde123456',
      '?mesa=abcde1234%20',
      "?mesa=abcde12345'%20OR%20'1'='1",
      '?mesa=abcde12345&mesa=abcde12345',
      '?mesa[]=abcde12345',
      '?mesa[x]=abcde12345',
      '?mesa=inexistent',
    ]
    for (const query of invalid) {
      const response = await client.get(`${url('com-mesa')}${query}`)
      response.assertStatus(200)
      assert.notProperty(response.body().data, 'table', query)
    }
  })

  test('mesa inativa, inexistente e consumo no local desabilitado respondem igual: sem table', async ({
    client,
    assert,
  }) => {
    const restaurant = await createRestaurant({ slug: 'com-mesa' })
    await table(restaurant.id, 'inativa001', 'Mesa Inativa', { is_active: false })
    await table(restaurant.id, 'ativa00001', 'Mesa Ativa')

    const inactive = await client.get(`${url('com-mesa')}?mesa=inativa001`)
    const missing = await client.get(`${url('com-mesa')}?mesa=naoexist01`)
    assert.deepEqual(inactive.body(), missing.body())
    assert.notProperty(inactive.body().data, 'table')

    await db.from('restaurants').where('id', restaurant.id).update({ accepts_dine_in: false })
    const disabled = await client.get(`${url('com-mesa')}?mesa=ativa00001`)
    disabled.assertStatus(200)
    assert.notProperty(disabled.body().data, 'table')
  })

  test('mesa de outro restaurante não vale; o mesmo identificador em dois restaurantes resolve cada um no seu', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurant({ slug: 'restaurante-a' })
    const b = await createRestaurant({ slug: 'restaurante-b' })
    await table(b.id, 'soambdoisb', 'Mesa Secreta de B')
    await table(a.id, 'repetida01', 'Mesa de A')
    await table(b.id, 'repetida01', 'Mesa de B')

    const foreign = await client.get(`${url('restaurante-a')}?mesa=soambdoisb`)
    foreign.assertStatus(200)
    assert.notProperty(foreign.body().data, 'table')
    assert.notInclude(JSON.stringify(foreign.body()), 'Secreta')

    const fromA = await client.get(`${url('restaurante-a')}?mesa=repetida01`)
    const fromB = await client.get(`${url('restaurante-b')}?mesa=repetida01`)
    assert.deepEqual(fromA.body().data.table, { name: 'Mesa de A' })
    assert.deepEqual(fromB.body().data.table, { name: 'Mesa de B' })
  })

  test('a consulta da mesa filtra por restaurant_id e o restaurante inativo continua 404', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurant({ slug: 'restaurante-a' })
    const b = await createRestaurant({ slug: 'restaurante-b' })
    await table(a.id, 'abcde12345', 'Mesa 5')
    await table(b.id, 'outra00001', 'Mesa de B')

    const queries: { sql: string; bindings: unknown[] }[] = []
    const knex = db.connection().getWriteClient()
    const listener = (q: { sql: string; bindings?: unknown[] }) =>
      queries.push({ sql: q.sql, bindings: q.bindings ?? [] })
    knex.on('query', listener)
    ;(await client.get(`${url('restaurante-a')}?mesa=abcde12345`)).assertStatus(200)
    knex.off('query', listener)

    const tableQueries = queries.filter((q) => /"restaurant_tables"/.test(q.sql))
    assert.lengthOf(tableQueries, 1)
    assert.include(tableQueries[0].sql, 'restaurant_id')
    assert.include(tableQueries[0].bindings, a.id)
    assert.notInclude(tableQueries[0].bindings, b.id)

    await db.from('restaurants').where('id', a.id).update({ is_active: false })
    ;(await client.get(`${url('restaurante-a')}?mesa=abcde12345`)).assertStatus(404)
  })
})
