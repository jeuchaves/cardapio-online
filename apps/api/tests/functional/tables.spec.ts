import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  authed,
  createRestaurant,
  createRestaurantWithTeam,
  createUser,
  link,
  loginAndGetCookie,
  ORIGIN,
  resetState,
} from '#tests/helpers'
import { createTable, generateTableIdentifier } from '#support/table_identifier'

// F4-T3: mesas do restaurante (somente owner). O identificador é contexto do pedido, não autenticação.

const IDENTIFIER = /^[a-z0-9]{10}$/
const base = (restaurantId: string) => `/api/v1/tenant/${restaurantId}/tables`

async function insertTable(restaurantId: string, name: string, identifier?: string) {
  const [row] = await db
    .table('restaurant_tables')
    .insert({
      restaurant_id: restaurantId,
      name,
      identifier: identifier ?? generateTableIdentifier(),
    })
    .returning('id')
  return row.id as string
}

async function pgCode(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return null
}

function captureQueries() {
  const queries: { sql: string; bindings: unknown[] }[] = []
  const knex = db.connection().getWriteClient()
  const listener = (query: { sql: string; bindings?: unknown[] }) => {
    queries.push({ sql: query.sql, bindings: query.bindings ?? [] })
  }
  knex.on('query', listener)
  return { queries, stop: () => knex.off('query', listener) }
}

test.group('Mesas | CRUD do owner', (group) => {
  group.each.setup(resetState)

  test('owner cria, lista ordenado, renomeia, desativa e exclui; o identificador é gerado pelo servidor', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)

    const created = await authed(client, 'post', url, cookie).json({ name: '  Mesa 5 ' })
    created.assertStatus(201)
    const table = created.body().data
    assert.equal(table.name, 'Mesa 5')
    assert.match(table.identifier, IDENTIFIER)
    assert.isTrue(table.is_active)
    assert.notProperty(table, 'restaurant_id')

    await authed(client, 'post', url, cookie).json({ name: 'Mesa 1' })
    const list = await authed(client, 'get', url, cookie)
    list.assertStatus(200)
    assert.deepEqual(
      list.body().data.map((t: { name: string }) => t.name),
      ['Mesa 1', 'Mesa 5']
    )

    const renamed = await authed(client, 'patch', `${url}/${table.id}`, cookie).json({
      name: 'Varanda',
      is_active: false,
    })
    renamed.assertStatus(200)
    assert.equal(renamed.body().data.name, 'Varanda')
    assert.isFalse(renamed.body().data.is_active)
    // Alterar a mesa não muda o identificador (o QR impresso continua valendo)
    assert.equal(renamed.body().data.identifier, table.identifier)

    const removed = await authed(client, 'delete', `${url}/${table.id}`, cookie)
    removed.assertStatus(204)
    assert.lengthOf(await db.from('restaurant_tables').where('restaurant_id', restaurant.id), 1)
    ;(await authed(client, 'delete', `${url}/${table.id}`, cookie)).assertStatus(404)
  })

  test('identificadores: 10 caracteres a-z0-9, únicos, não sequenciais e sem relação com a ordem de criação', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const identifiers: string[] = []
    for (let i = 1; i <= 30; i++) {
      const response = await authed(client, 'post', base(restaurant.id), cookie).json({
        name: `Mesa ${i}`,
      })
      response.assertStatus(201)
      identifiers.push(response.body().data.identifier)
    }
    for (const identifier of identifiers) assert.match(identifier, IDENTIFIER)
    assert.lengthOf(new Set(identifiers).size === 30 ? identifiers : [], 30)
    // Não crescem nem decrescem em ordem: uma sequência tornaria as mesas adivinháveis
    const ascending = identifiers.every((value, i) => i === 0 || value > identifiers[i - 1])
    const descending = identifiers.every((value, i) => i === 0 || value < identifiers[i - 1])
    assert.isFalse(ascending)
    assert.isFalse(descending)
    // Nenhum identificador é derivado do nome nem do número da mesa
    for (const [i, identifier] of identifiers.entries()) {
      assert.notInclude(identifier, `mesa${i + 1}`)
    }
  })

  test('criações simultâneas geram identificadores distintos', async ({ client, assert }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        authed(client, 'post', base(restaurant.id), cookie).json({ name: `Mesa ${i}` })
      )
    )
    for (const response of responses) response.assertStatus(201)
    const identifiers = responses.map((r) => r.body().data.identifier)
    assert.lengthOf([...new Set(identifiers)], 12)
    assert.lengthOf(await db.from('restaurant_tables'), 12)
  })

  test('nomes repetidos são aceitos (a mesa se distingue pelo identificador)', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    for (let i = 0; i < 2; i++) {
      ;(
        await authed(client, 'post', base(restaurant.id), cookie).json({ name: 'Mesa 1' })
      ).assertStatus(201)
    }
    assert.lengthOf(await db.from('restaurant_tables'), 2)
  })

  test('mesas inativas continuam na listagem do painel, com o estado visível', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const id = await insertTable(restaurant.id, 'Mesa 1')
    ;(
      await authed(client, 'patch', `${base(restaurant.id)}/${id}`, cookie).json({
        is_active: false,
      })
    ).assertStatus(200)
    const list = await authed(client, 'get', base(restaurant.id), cookie)
    assert.lengthOf(list.body().data, 1)
    assert.isFalse(list.body().data[0].is_active)
  })
})

test.group('Mesas | autorização', (group) => {
  group.each.setup(resetState)

  test('staff é recusado (403) em todas as rotas de mesas e nada muda', async ({
    client,
    assert,
  }) => {
    const { restaurant, staff } = await createRestaurantWithTeam()
    const id = await insertTable(restaurant.id, 'Mesa 1', 'aaaaaaaaaa')
    const cookie = await loginAndGetCookie(client, staff.email)
    const url = base(restaurant.id)

    ;(await authed(client, 'get', url, cookie)).assertStatus(403)
    ;(await authed(client, 'post', url, cookie).json({ name: 'Mesa 2' })).assertStatus(403)
    ;(await authed(client, 'patch', `${url}/${id}`, cookie).json({ name: 'X' })).assertStatus(403)
    ;(
      await authed(client, 'patch', `${url}/${id}`, cookie).json({ is_active: false })
    ).assertStatus(403)
    ;(await authed(client, 'delete', `${url}/${id}`, cookie)).assertStatus(403)

    const rows = await db.from('restaurant_tables')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].name, 'Mesa 1')
    assert.isTrue(rows[0].is_active)
  })

  test('sem sessão: 401 e nenhuma mesa é criada ou alterada', async ({ client, assert }) => {
    const { restaurant } = await createRestaurantWithTeam()
    const id = await insertTable(restaurant.id, 'Mesa 1')
    const url = base(restaurant.id)
    const headers = { Origin: ORIGIN }
    ;(await client.get(url).headers(headers)).assertStatus(401)
    ;(await client.post(url).headers(headers).json({ name: 'X' })).assertStatus(401)
    ;(await client.patch(`${url}/${id}`).headers(headers).json({ name: 'X' })).assertStatus(401)
    ;(await client.delete(`${url}/${id}`).headers(headers)).assertStatus(401)
    assert.lengthOf(await db.from('restaurant_tables'), 1)
    assert.equal((await db.from('restaurant_tables').first()).name, 'Mesa 1')
  })

  test('escrita sem Origin é recusada (CSRF) mesmo com sessão válida', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const response = await client
      .post(base(restaurant.id))
      .header('Cookie', cookie)
      .json({ name: 'Mesa 1' })
    response.assertStatus(403)
    assert.lengthOf(await db.from('restaurant_tables'), 0)
  })
})

test.group('Mesas | validação', (group) => {
  group.each.setup(resetState)

  test('criação rejeita nome vazio ou longo, campos desconhecidos e tipos errados (422)', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    const bodies = [
      {},
      { name: '' },
      { name: '   ' },
      { name: 'a'.repeat(61) },
      { name: 5 },
      { name: null },
      { name: 'Mesa 1', identifier: 'abcdefghij' },
      { name: 'Mesa 1', restaurant_id: restaurant.id },
      { name: 'Mesa 1', is_active: false },
    ]
    for (const body of bodies) {
      const response = await authed(client, 'post', url, cookie).json(body)
      assert.equal(response.status(), 422, JSON.stringify(body))
    }
    assert.lengthOf(await db.from('restaurant_tables'), 0)
    ;(await authed(client, 'post', url, cookie).json({ name: 'a'.repeat(60) })).assertStatus(201)
  })

  test('edição rejeita corpo vazio, identificador, tipos errados e valores em branco (422); nada muda', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const id = await insertTable(restaurant.id, 'Mesa 1', 'abcdefghij')
    const url = `${base(restaurant.id)}/${id}`
    const bodies = [
      {},
      { name: '' },
      { name: null },
      { name: 'a'.repeat(61) },
      { is_active: 'false' },
      { is_active: 0 },
      { is_active: null },
      { identifier: 'zzzzzzzzzz' },
      { name: 'X', restaurant_id: restaurant.id },
    ]
    for (const body of bodies) {
      const response = await authed(client, 'patch', url, cookie).json(body)
      assert.equal(response.status(), 422, JSON.stringify(body))
    }
    const row = await db.from('restaurant_tables').where('id', id).first()
    assert.equal(row.name, 'Mesa 1')
    assert.equal(row.identifier, 'abcdefghij')
    assert.isTrue(row.is_active)
  })

  test('id malformado na rota responde 404, sem chegar ao banco', async ({ client }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const url = base(restaurant.id)
    ;(await authed(client, 'patch', `${url}/nao-e-uuid`, cookie).json({ name: 'X' })).assertStatus(
      404
    )
    ;(await authed(client, 'delete', `${url}/1`, cookie)).assertStatus(404)
    ;(await authed(client, 'delete', `${url}/${crypto.randomUUID()}`, cookie)).assertStatus(404)
  })
})

test.group('Mesas | geração do identificador', (group) => {
  group.each.setup(resetState)

  test('colisão de identificador: sorteia outro e tenta de novo; a restrição UNIQUE é a garantia', async ({
    assert,
  }) => {
    const restaurant = await createRestaurant()
    await insertTable(restaurant.id, 'Mesa 1', 'aaaaaaaaaa')
    await insertTable(restaurant.id, 'Mesa 2', 'bbbbbbbbbb')
    const sequence = ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc']
    let calls = 0
    const table = await createTable(restaurant.id, 'Mesa 3', () => sequence[calls++])
    assert.equal(table.identifier, 'cccccccccc')
    assert.equal(calls, 3)
    assert.lengthOf(await db.from('restaurant_tables'), 3)
  })

  test('colisões repetidas esgotam as tentativas e o erro não vaza dados parciais', async ({
    assert,
  }) => {
    const restaurant = await createRestaurant()
    await insertTable(restaurant.id, 'Mesa 1', 'aaaaaaaaaa')
    let calls = 0
    let failed = false
    try {
      await createTable(restaurant.id, 'Mesa 2', () => {
        calls++
        return 'aaaaaaaaaa'
      })
    } catch (error) {
      failed = (error as { code?: string }).code === '23505'
    }
    assert.isTrue(failed)
    assert.equal(calls, 5)
    assert.lengthOf(await db.from('restaurant_tables'), 1)
  })

  test('o mesmo identificador pode existir em restaurantes diferentes, mas nunca duas vezes no mesmo', async ({
    assert,
  }) => {
    const a = await createRestaurant()
    const b = await createRestaurant()
    await insertTable(a.id, 'Mesa 1', 'aaaaaaaaaa')
    await insertTable(b.id, 'Mesa 1', 'aaaaaaaaaa')
    assert.equal(await pgCode(() => insertTable(a.id, 'Mesa 2', 'aaaaaaaaaa')), '23505')
  })

  test('o gerador produz só caracteres válidos', ({ assert }) => {
    for (let i = 0; i < 500; i++) assert.match(generateTableIdentifier(), IDENTIFIER)
  })
})

test.group('Mesas | schema', (group) => {
  group.each.setup(resetState)

  test('o banco recusa identificador fora do formato e nome longo demais', async ({ assert }) => {
    const restaurant = await createRestaurant()
    for (const identifier of ['curto', 'AAAAAAAAAA', 'aaaaaaaaa-', 'aaaaaaaaaaa', '']) {
      assert.equal(await pgCode(() => insertTable(restaurant.id, 'Mesa', identifier)), '23514')
    }
    assert.equal(
      await pgCode(() => insertTable(restaurant.id, 'a'.repeat(61), 'aaaaaaaaaa')),
      '22001'
    )
  })

  test('UNIQUE (id, restaurant_id) existe para a FK composta de orders', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT array_agg(a.attname::text ORDER BY a.attname)::text[] AS colunas
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'u' AND c.conrelid = 'restaurant_tables'::regclass
        GROUP BY c.oid`
    )
    const sets = result.rows.map((row: { colunas: string[] }) => row.colunas.join())
    assert.include(sets, 'id,restaurant_id')
    assert.include(sets, 'identifier,restaurant_id')
  })

  test('restaurante com mesas não pode ser excluído (RESTRICT)', async ({ assert }) => {
    const restaurant = await createRestaurant()
    await insertTable(restaurant.id, 'Mesa 1')
    assert.equal(
      await pgCode(() => db.from('restaurants').where('id', restaurant.id).delete()),
      '23503'
    )
  })
})

test.group('Mesas | isolamento entre restaurantes', (group) => {
  group.each.setup(resetState)

  async function twoRestaurants() {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const tableA = await insertTable(a.restaurant.id, 'Mesa A', 'aaaaaaaaaa')
    const tableB = await insertTable(b.restaurant.id, 'Mesa B', 'bbbbbbbbbb')
    return { a, b, tableA, tableB }
  }

  const snapshot = async () =>
    JSON.stringify(await db.from('restaurant_tables').orderBy('identifier'))

  test('owner de A não lê, altera nem exclui a mesa de B conhecendo o id (404) e nada muda', async ({
    client,
    assert,
  }) => {
    const { a, b, tableB } = await twoRestaurants()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const before = await snapshot()

    // Pela URL do próprio restaurante, com o id de B
    const own = base(a.restaurant.id)
    ;(
      await authed(client, 'patch', `${own}/${tableB}`, cookie).json({ name: 'Hack' })
    ).assertStatus(404)
    ;(
      await authed(client, 'patch', `${own}/${tableB}`, cookie).json({ is_active: false })
    ).assertStatus(404)
    ;(await authed(client, 'delete', `${own}/${tableB}`, cookie)).assertStatus(404)

    // Pela URL de B (sem vínculo)
    const foreign = base(b.restaurant.id)
    ;(await authed(client, 'get', foreign, cookie)).assertStatus(404)
    ;(await authed(client, 'post', foreign, cookie).json({ name: 'Nova' })).assertStatus(404)
    ;(
      await authed(client, 'patch', `${foreign}/${tableB}`, cookie).json({ name: 'X' })
    ).assertStatus(404)
    ;(await authed(client, 'delete', `${foreign}/${tableB}`, cookie)).assertStatus(404)

    assert.equal(await snapshot(), before)
  })

  test('a listagem de A contém só as mesas de A', async ({ client, assert }) => {
    const { a, b } = await twoRestaurants()
    await insertTable(b.restaurant.id, 'Mesa B2')
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const list = await authed(client, 'get', base(a.restaurant.id), cookie)
    assert.deepEqual(
      list.body().data.map((t: { name: string }) => t.name),
      ['Mesa A']
    )
  })

  test('staff de A também recebe 403 (perfil) ou 404 (outro restaurante), sem alterar nada', async ({
    client,
    assert,
  }) => {
    const { a, b, tableA, tableB } = await twoRestaurants()
    const cookie = await loginAndGetCookie(client, a.staff.email)
    const before = await snapshot()
    ;(await authed(client, 'delete', `${base(a.restaurant.id)}/${tableA}`, cookie)).assertStatus(
      403
    )
    ;(await authed(client, 'delete', `${base(b.restaurant.id)}/${tableB}`, cookie)).assertStatus(
      404
    )
    assert.equal(await snapshot(), before)
  })

  test('sem vínculo, vínculo inativo e platform_admin: 404 em todas as rotas, nada muda e nenhuma consulta toca as mesas', async ({
    client,
    assert,
  }) => {
    const { b, tableB } = await twoRestaurants()
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

    const before = await snapshot()
    const capture = captureQueries()
    const url = base(b.restaurant.id)
    for (const cookie of [unlinkedCookie, inactiveCookie, adminCookie]) {
      ;(await authed(client, 'get', url, cookie)).assertStatus(404)
      ;(await authed(client, 'post', url, cookie).json({ name: 'X' })).assertStatus(404)
      ;(await authed(client, 'patch', `${url}/${tableB}`, cookie).json({ name: 'X' })).assertStatus(
        404
      )
      ;(await authed(client, 'delete', `${url}/${tableB}`, cookie)).assertStatus(404)
    }
    capture.stop()
    assert.equal(await snapshot(), before)
    assert.lengthOf(
      capture.queries.filter((q) => q.sql.includes('"restaurant_tables"')),
      0
    )
  })

  test('usuário com vínculo em dois restaurantes acessa cada um só pelo vínculo correspondente', async ({
    client,
    assert,
  }) => {
    const a = await createRestaurantWithTeam()
    const b = await createRestaurantWithTeam()
    const tableA = await insertTable(a.restaurant.id, 'Mesa A', 'aaaaaaaaaa')
    const tableB = await insertTable(b.restaurant.id, 'Mesa B', 'bbbbbbbbbb')
    const multi = await createUser()
    await link(multi, a.restaurant, 'owner')
    await link(multi, b.restaurant, 'staff')
    const cookie = await loginAndGetCookie(client, multi.email)

    // Owner em A: opera; staff em B: 403 nas mesas de B
    ;(await authed(client, 'get', base(a.restaurant.id), cookie)).assertStatus(200)
    ;(await authed(client, 'get', base(b.restaurant.id), cookie)).assertStatus(403)
    ;(await authed(client, 'delete', `${base(b.restaurant.id)}/${tableB}`, cookie)).assertStatus(
      403
    )
    // Os ids de um restaurante não valem no outro
    ;(await authed(client, 'delete', `${base(a.restaurant.id)}/${tableB}`, cookie)).assertStatus(
      404
    )
    ;(
      await authed(client, 'patch', `${base(a.restaurant.id)}/${tableA}`, cookie).json({
        name: 'Renomeada',
      })
    ).assertStatus(200)
    assert.equal((await db.from('restaurant_tables').where('id', tableB).first()).name, 'Mesa B')
  })

  test('toda consulta de mesas carrega restaurant_id do tenant autorizado e nunca o de outro', async ({
    client,
    assert,
  }) => {
    const { a, b, tableA } = await twoRestaurants()
    const cookie = await loginAndGetCookie(client, a.owner.email)
    const url = base(a.restaurant.id)
    const capture = captureQueries()
    ;(await authed(client, 'get', url, cookie)).assertStatus(200)
    const created = await authed(client, 'post', url, cookie).json({ name: 'Nova' })
    created.assertStatus(201)
    ;(await authed(client, 'patch', `${url}/${tableA}`, cookie).json({ name: 'Y' })).assertStatus(
      200
    )
    ;(await authed(client, 'delete', `${url}/${created.body().data.id}`, cookie)).assertStatus(204)
    capture.stop()

    const tableQueries = capture.queries.filter((q) => q.sql.includes('"restaurant_tables"'))
    // index (1) + insert (1) + patch: leitura, update, releitura (3) + delete (1)
    assert.isAtLeast(tableQueries.length, 6)
    for (const query of tableQueries) {
      assert.isTrue(query.sql.includes('restaurant_id'), `sem restaurant_id: ${query.sql}`)
      assert.isTrue(query.bindings.includes(a.restaurant.id), `sem o tenant: ${query.sql}`)
      assert.isFalse(query.bindings.includes(b.restaurant.id), `tenant alheio: ${query.sql}`)
    }
  })
})
