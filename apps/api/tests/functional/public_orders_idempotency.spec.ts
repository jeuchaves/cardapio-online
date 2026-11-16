import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { resetState } from '#tests/helpers'
import {
  counts,
  insertId,
  newKey,
  nextNumber,
  orderBody,
  postOrder,
  setup,
  type Client,
  type Setup,
} from '#tests/order_helpers'
import { hashOrderInput } from '#support/order_hash'

// F5-T3: idempotência na criação do pedido (ROADMAP 5.5, passos 2, 3 e 11).

const ONE = { orders: 1, items: 1, addons: 1, history: 1 }

async function secondProduct(s: Setup, name: string, price: string) {
  return insertId('products', {
    restaurant_id: s.id,
    category_id: s.categoryId,
    name,
    price,
  })
}

test.group('Idempotência | hash do payload normalizado', () => {
  const base = {
    customer: { name: 'Maria', phone: '11999990000' },
    fulfillment_type: 'dine_in',
    payment_method: 'cash',
    table_identifier: 'mesa123456',
    notes: 'sem cebola',
    items: [
      { product_id: 'b0000000-0000-4000-8000-000000000000', quantity: 1, addon_ids: ['2', '1'] },
      { product_id: 'a0000000-0000-4000-8000-000000000000', quantity: 2 },
    ],
  }

  test('ordem de itens e adicionais e telefone ausente ou em branco não mudam o hash', ({
    assert,
  }) => {
    const reference = hashOrderInput(base)
    assert.match(reference, /^[0-9a-f]{64}$/)
    const reordered = {
      ...base,
      items: [
        { product_id: 'a0000000-0000-4000-8000-000000000000', quantity: 2, addon_ids: [] },
        { product_id: 'b0000000-0000-4000-8000-000000000000', quantity: 1, addon_ids: ['1', '2'] },
      ],
    }
    assert.equal(hashOrderInput(reordered), reference)

    const noPhone = { ...base, customer: { name: 'Maria' } }
    const withPhone = hashOrderInput(base)
    assert.notEqual(hashOrderInput(noPhone), withPhone)
    assert.equal(
      hashOrderInput({ ...noPhone, notes: undefined }),
      hashOrderInput({ ...base, customer: { name: 'Maria' }, notes: undefined })
    )
  })

  test('qualquer diferença de conteúdo muda o hash', ({ assert }) => {
    const reference = hashOrderInput(base)
    const variants = [
      { ...base, customer: { ...base.customer, name: 'Mário' } },
      { ...base, customer: { ...base.customer, phone: '11888880000' } },
      { ...base, fulfillment_type: 'pickup' },
      { ...base, payment_method: 'pix' },
      { ...base, table_identifier: 'outra123456' },
      { ...base, notes: 'com cebola' },
      { ...base, items: [{ ...base.items[0], quantity: 2 }, base.items[1]] },
      { ...base, items: [{ ...base.items[0], addon_ids: ['1'] }, base.items[1]] },
      { ...base, items: [base.items[0]] },
    ]
    for (const variant of variants) assert.notEqual(hashOrderInput(variant), reference)
  })
})

test.group('Idempotência | replay e conflito', (group) => {
  group.each.setup(resetState)

  test('repetição idêntica: 200 com o mesmo corpo e token, sem novo pedido nem número', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s))
    first.assertStatus(201)
    const again = await postOrder(client, s, key, orderBody(s))
    again.assertStatus(200)
    assert.equal(again.header('cache-control'), 'no-store')
    assert.deepEqual(again.body(), first.body())
    assert.deepEqual(await counts(), ONE)
    assert.equal(await nextNumber(s.id), 1002)
  })

  test('payload equivalente (itens em outra ordem, espaços extras) também é replay', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const other = await secondProduct(s, 'Alface', '3.00')
    const items = [
      { product_id: s.productId, quantity: 1, addon_ids: [s.addonId, s.addon2Id] },
      { product_id: other, quantity: 2 },
    ]
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s, { items }))
    first.assertStatus(201)
    const again = await postOrder(
      client,
      s,
      key,
      orderBody(s, {
        customer: { name: '  Maria  ', phone: ' 11999990000 ' },
        items: [
          { product_id: other, quantity: 2, addon_ids: [] },
          { product_id: s.productId, quantity: 1, addon_ids: [s.addon2Id, s.addonId] },
        ],
      })
    )
    again.assertStatus(200)
    assert.deepEqual(again.body(), first.body())
    assert.equal((await counts()).orders, 1)
  })

  test('o replay não depende do catálogo: preço alterado, produto indisponível ou excluído', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s))
    first.assertStatus(201)
    assert.equal(first.body().data.total, '24.00')

    await db.from('products').where('id', s.productId).update({ price: '99.00' })
    const afterPrice = await postOrder(client, s, key, orderBody(s))
    afterPrice.assertStatus(200)
    assert.deepEqual(afterPrice.body(), first.body())

    await db.from('products').where('id', s.productId).update({ is_available: false })
    ;(await postOrder(client, s, key, orderBody(s))).assertStatus(200)

    await db.from('product_product_addons').where('restaurant_id', s.id).delete()
    await db.from('products').where('id', s.productId).delete()
    await db.from('product_addons').where('restaurant_id', s.id).delete()
    const afterDelete = await postOrder(client, s, key, orderBody(s))
    afterDelete.assertStatus(200)
    const body = afterDelete.body().data
    assert.equal(body.tracking_token, first.body().data.tracking_token)
    assert.equal(body.total, '24.00')
    assert.equal(body.items[0].name, 'Hambúrguer')
    assert.equal(body.items[0].subtotal, '24.00')
    assert.isNull(body.items[0].product_id)
    assert.equal(body.items[0].addons[0].name, 'Bacon')
    assert.isNull(body.items[0].addons[0].id)
    assert.equal((await counts()).orders, 1)
  })

  test('o replay mostra o status atual do pedido', async ({ client, assert }) => {
    const s = await setup()
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s))
    assert.equal(first.body().data.status, 'pending')
    await db.from('orders').where('restaurant_id', s.id).update({ status: 'confirmed' })
    const again = await postOrder(client, s, key, orderBody(s))
    again.assertStatus(200)
    assert.equal(again.body().data.status, 'confirmed')
    assert.equal(again.body().data.tracking_token, first.body().data.tracking_token)
  })

  test('mesma chave com conteúdo diferente: 409 sem pedido, sem número e sem dados do pedido', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    await insertId('restaurant_tables', {
      restaurant_id: s.id,
      name: 'Mesa 9',
      identifier: 'mesa999999',
    })
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s))
    first.assertStatus(201)
    const token = first.body().data.tracking_token

    const withoutTable: Record<string, unknown> = orderBody(s)
    delete withoutTable.table_identifier
    const variants: Record<string, unknown>[] = [
      { items: [{ product_id: s.productId, quantity: 3, addon_ids: [s.addonId] }] },
      { items: [{ product_id: s.productId, quantity: 2, addon_ids: [s.addonId, s.addon2Id] }] },
      { items: [{ product_id: s.productId, quantity: 2 }] },
      { payment_method: 'card' },
      { notes: 'outra observação' },
      { customer: { name: 'Maria', phone: '11888880000' } },
      { customer: { name: 'Outra Pessoa', phone: '11999990000' } },
      { table_identifier: 'mesa999999' },
      { ...withoutTable, fulfillment_type: 'pickup' },
    ]
    for (const variant of variants) {
      const payload = 'fulfillment_type' in variant ? variant : orderBody(s, variant)
      const response = await postOrder(client, s, key, payload)
      response.assertStatus(409)
      assert.equal(response.body().code, 'CONFLICT')
      assert.notProperty(response.body(), 'data')
      assert.notProperty(response.body(), 'details')
      assert.notInclude(JSON.stringify(response.body()), token)
      assert.notInclude(JSON.stringify(response.body()), 'tracking_token')
    }
    assert.deepEqual(await counts(), ONE)
    assert.equal(await nextNumber(s.id), 1002)
  })

  test('payload inválido com chave já usada responde 422, nunca replay', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()
    ;(await postOrder(client, s, key, orderBody(s))).assertStatus(201)
    const invalid = orderBody(s, {
      items: [{ product_id: s.productId, quantity: 0, addon_ids: [] }],
    })
    const response = await postOrder(client, s, key, invalid)
    response.assertStatus(422)
    assert.equal(response.body().code, 'VALIDATION_ERROR')
    assert.notInclude(JSON.stringify(response.body()), 'tracking_token')
  })

  test('modalidade desabilitada depois da criação: a repetição recebe 422 (ordem do ROADMAP)', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()
    ;(await postOrder(client, s, key, orderBody(s))).assertStatus(201)
    await db.from('restaurants').where('id', s.id).update({ accepts_dine_in: false })
    const response = await postOrder(client, s, key, orderBody(s))
    response.assertStatus(422)
    assert.equal(response.body().details[0].field, 'fulfillment_type')
  })

  test('as respostas 201 e 200 trazem itens e adicionais em ordem canônica (nome e id)', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const zebra = await secondProduct(s, 'Zebra', '1.00')
    const items = [
      { product_id: zebra, quantity: 1 },
      { product_id: s.productId, quantity: 1, addon_ids: [s.addon2Id, s.addonId] },
    ]
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s, { items }))
    first.assertStatus(201)
    const names = first.body().data.items.map((item: { name: string }) => item.name)
    assert.deepEqual(names, ['Hambúrguer', 'Zebra'])
    const addons = first.body().data.items[0].addons.map((a: { name: string }) => a.name)
    assert.deepEqual(addons, ['Bacon', 'Queijo'])
    const again = await postOrder(client, s, key, orderBody(s, { items }))
    again.assertStatus(200)
    assert.deepEqual(again.body(), first.body())
  })
})

test.group('Idempotência | desempate da ordem canônica', (group) => {
  group.each.setup(resetState)

  // Dois produtos de mesmo nome (3.00 e 4.00); o primeiro com dois adicionais (nomes de adicional
  // são únicos por restaurante, então não há empate de adicionais no pedido)
  async function twins(s: Setup) {
    const first = await secondProduct(s, 'Gêmeo', '3.00')
    const second = await secondProduct(s, 'Gêmeo', '4.00')
    const extras: string[] = []
    for (const [name, price] of [
      ['Extra A', '1.00'],
      ['Extra B', '2.00'],
    ]) {
      const addonId = await insertId('product_addons', {
        restaurant_id: s.id,
        name,
        price,
      })
      await db
        .table('product_product_addons')
        .insert({ restaurant_id: s.id, product_id: first, product_addon_id: addonId })
      extras.push(addonId)
    }
    const items = [
      { product_id: first, quantity: 1, addon_ids: extras },
      { product_id: second, quantity: 1 },
    ]
    return { items, products: [first, second], extras }
  }

  test('com referências vivas, o 201 e o replay têm a mesma ordem', async ({ client, assert }) => {
    const s = await setup()
    const { items } = await twins(s)
    const key = newKey()
    const first = await postOrder(client, s, key, orderBody(s, { items }))
    first.assertStatus(201)
    const again = await postOrder(client, s, key, orderBody(s, { items }))
    again.assertStatus(200)
    assert.deepEqual(again.body(), first.body())
  })

  test('com produtos excluídos (id nulo), o replay é determinístico e desempata pelo id da linha', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const { items, products, extras } = await twins(s)
    const key = newKey()
    ;(await postOrder(client, s, key, orderBody(s, { items }))).assertStatus(201)

    await db.from('product_product_addons').where('restaurant_id', s.id).delete()
    await db.from('products').whereIn('id', products).delete()
    await db.from('product_addons').whereIn('id', extras).delete()

    // Ordem esperada: nome, id nulo e, por último, o id persistente da linha (comparação simples)
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    const rows = (await db.from('order_items').where('restaurant_id', s.id)).sort(byId)
    const expectedItems = rows.map((row) => row.unit_price)
    const bodies = []
    for (let i = 0; i < 5; i++) {
      const response = await postOrder(client, s, key, orderBody(s, { items }))
      response.assertStatus(200)
      bodies.push(response.body())
    }
    for (const body of bodies) assert.deepEqual(body, bodies[0])
    const replayed = bodies[0].data.items
    assert.deepEqual(
      replayed.map((item: { unit_price: string }) => item.unit_price),
      expectedItems
    )
    const withAddons = replayed.find((item: { unit_price: string }) => item.unit_price === '3.00')
    assert.deepEqual(
      withAddons.addons.map((addon: { name: string }) => addon.name),
      ['Extra A', 'Extra B']
    )
    assert.isNull(replayed[0].product_id)
  })
})

test.group('Idempotência | isolamento por restaurante', (group) => {
  group.each.setup(resetState)

  test('a mesma chave em dois restaurantes cria dois pedidos independentes', async ({
    client,
    assert,
  }) => {
    const a = await setup()
    const b = await setup()
    const key = newKey()
    const orderA = await postOrder(client, a, key, orderBody(a))
    const orderB = await postOrder(client, b, key, orderBody(b))
    orderA.assertStatus(201)
    orderB.assertStatus(201)
    assert.equal(orderA.body().data.order_number, 1001)
    assert.equal(orderB.body().data.order_number, 1001)
    assert.notEqual(orderA.body().data.tracking_token, orderB.body().data.tracking_token)

    // Cada restaurante só enxerga o próprio pedido na repetição
    const replayA = await postOrder(client, a, key, orderBody(a))
    replayA.assertStatus(200)
    assert.equal(replayA.body().data.tracking_token, orderA.body().data.tracking_token)
    const replayB = await postOrder(client, b, key, orderBody(b))
    assert.equal(replayB.body().data.tracking_token, orderB.body().data.tracking_token)
    assert.equal((await counts()).orders, 2)
  })

  test('chave de um restaurante usada em outro nunca devolve o pedido nem o token do primeiro', async ({
    client,
    assert,
  }) => {
    const a = await setup()
    const b = await setup()
    const key = newKey()
    const orderA = await postOrder(client, a, key, orderBody(a))
    orderA.assertStatus(201)

    // Payload diferente do de A: em B não há conflito, porque a chave não existe lá
    const inB = await postOrder(
      client,
      b,
      key,
      orderBody(b, { items: [{ product_id: b.productId, quantity: 5 }] })
    )
    inB.assertStatus(201)
    assert.notEqual(inB.body().data.tracking_token, orderA.body().data.tracking_token)
    assert.equal(inB.body().data.total, '50.00')

    // Mesmo payload de A, enviado a B: também cria um pedido novo, nunca o de A
    const key2 = newKey()
    const first = await postOrder(client, a, key2, orderBody(a))
    const sameInB = await postOrder(client, b, key2, orderBody(b))
    sameInB.assertStatus(201)
    assert.notEqual(sameInB.body().data.tracking_token, first.body().data.tracking_token)
    assert.notInclude(JSON.stringify(sameInB.body()), first.body().data.tracking_token)
    assert.lengthOf(await db.from('orders').where('restaurant_id', b.id), 2)
    assert.lengthOf(await db.from('orders').where('restaurant_id', a.id), 2)
  })
})

test.group('Idempotência | concorrência real', (group) => {
  group.each.setup(resetState)

  test('5 requisições idênticas simultâneas: um 201, quatro 200, um único pedido', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => postOrder(client, s, key, orderBody(s)))
    )
    const statuses = responses.map((r) => r.status()).sort()
    assert.deepEqual(statuses, [200, 200, 200, 200, 201])
    const tokens = new Set(responses.map((r) => r.body().data.tracking_token))
    assert.equal(tokens.size, 1)
    assert.deepEqual(await counts(), ONE)
    assert.equal(await nextNumber(s.id), 1002)
    for (const response of responses) assert.equal(response.body().data.order_number, 1001)
  })

  test('mesma chave com conteúdos diferentes ao mesmo tempo: um 201 e um 409', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()
    const responses = await Promise.all([
      postOrder(client, s, key, orderBody(s)),
      postOrder(
        client,
        s,
        key,
        orderBody(s, { items: [{ product_id: s.productId, quantity: 4 }] })
      ),
    ])
    assert.deepEqual(responses.map((r) => r.status()).sort(), [201, 409])
    const loser = responses.find((r) => r.status() === 409)!
    const winner = responses.find((r) => r.status() === 201)!
    assert.notInclude(JSON.stringify(loser.body()), winner.body().data.tracking_token)
    assert.equal((await counts()).orders, 1)
    assert.equal(await nextNumber(s.id), 1002)
  })

  test('8 pedidos simultâneos com chaves diferentes: números únicos, 1001 a 1008', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => postOrder(client, s, newKey(), orderBody(s)))
    )
    for (const response of responses) response.assertStatus(201)
    const numbers = responses.map((r) => r.body().data.order_number).sort((x, y) => x - y)
    assert.deepEqual(numbers, [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008])
    assert.equal(new Set(responses.map((r) => r.body().data.tracking_token)).size, 8)
    assert.equal((await counts()).orders, 8)
    assert.equal(await nextNumber(s.id), 1009)
  })

  test('falhas no meio não deixam lacuna: só os sucessos consomem número', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const bad = orderBody(s, { items: [{ product_id: randomUUID(), quantity: 1 }] })
    const requests: Promise<Client>[] = []
    for (let i = 0; i < 8; i++) {
      requests.push(postOrder(client, s, newKey(), i % 2 === 0 ? orderBody(s) : bad))
    }
    const responses = await Promise.all(requests)
    const ok = responses.filter((r) => r.status() === 201)
    const failed = responses.filter((r) => r.status() === 422)
    assert.lengthOf(ok, 4)
    assert.lengthOf(failed, 4)
    const numbers = ok.map((r) => r.body().data.order_number).sort((x, y) => x - y)
    assert.deepEqual(numbers, [1001, 1002, 1003, 1004])
    assert.equal(await nextNumber(s.id), 1005)
  })

  test('numeração independente entre restaurantes sob concorrência', async ({ client, assert }) => {
    const a = await setup()
    const b = await setup()
    const targets = [a, b, a, b, a, b]
    const responses = await Promise.all(
      targets.map((target) => postOrder(client, target, newKey(), orderBody(target)))
    )
    for (const response of responses) response.assertStatus(201)
    const numbersOf = (target: Setup) =>
      responses
        .filter((_response, index) => targets[index] === target)
        .map((response) => response.body().data.order_number as number)
        .sort((x, y) => x - y)
    assert.deepEqual(numbersOf(a), [1001, 1002, 1003])
    assert.deepEqual(numbersOf(b), [1001, 1002, 1003])
    assert.equal(await nextNumber(a.id), 1004)
    assert.equal(await nextNumber(b.id), 1004)
  })

  test('corrida determinística: a segunda requisição perde no INSERT, desfaz o número e devolve o pedido vencedor', async ({
    client,
    assert,
  }) => {
    const s = await setup()
    const key = newKey()

    async function waiting(pattern: string) {
      const result = await db.rawQuery(
        `select count(*)::int as n from pg_stat_activity
          where wait_event_type = 'Lock' and datname = current_database()
            and query ilike ?`,
        [pattern]
      )
      return result.rows[0].n as number
    }
    async function waitUntil(pattern: string, other: () => boolean) {
      for (let i = 0; i < 100 && !other(); i++) {
        if ((await waiting(pattern)) > 0) return true
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return false
    }

    // Segura a linha do produto: o FOR SHARE da requisição A espera aqui
    const blocker = await db.transaction()
    await blocker.rawQuery('select id from products where id = ? for update', [s.productId])

    let aSettled = false
    let bSettled = false
    const requestA = postOrder(client, s, key, orderBody(s)).finally(() => {
      aSettled = true
    })
    let requestB: Promise<Client> | null = null
    let observedA = false
    let observedB = false
    try {
      // A já reservou o número (UPDATE em restaurants) e espera o FOR SHARE de products
      observedA = await waitUntil('%from "products"%for share%', () => aSettled)
      // B não acha o pedido de A (não commitado), abre a transação e espera o UPDATE em restaurants
      requestB = postOrder(client, s, key, orderBody(s)).finally(() => {
        bSettled = true
      })
      observedB = await waitUntil('%update restaurants%', () => bSettled)
    } finally {
      await blocker.commit()
    }
    const [responseA, responseB] = await Promise.all([requestA, requestB!])

    assert.isTrue(observedA, 'A não ficou esperando o FOR SHARE de products')
    assert.isTrue(observedB, 'B não ficou esperando o UPDATE de restaurants')
    responseA.assertStatus(201)
    responseB.assertStatus(200)
    assert.deepEqual(responseB.body(), responseA.body())
    assert.deepEqual(await counts(), ONE)
    // O número que B chegou a reservar foi desfeito no rollback
    assert.equal(await nextNumber(s.id), 1002)
  })
})
