import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { Logger } from '@adonisjs/core/logger'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import loggerConfig, { REDACT_PATHS } from '#config/logger'
import HttpExceptionHandler from '#exceptions/handler'
import { sanitizeError } from '#support/log_error'
import { resetState } from '#tests/helpers'
import { newKey, orderBody, postOrder, setup } from '#tests/order_helpers'

// F5-T5: nada de token, dados pessoais ou payload nos logs (ROADMAP 7.3).

const NAME = 'Zé Segredo da Silva'
const PHONE = '11987654321'
const NOTES = 'observação-confidencial-123'
const ROUTE = '/api/v1/public/orders/:trackingToken'

// Logger real da aplicação (mesma config, inclusive `redact`), escrevendo em memória
function memoryLogger() {
  const lines: string[] = []
  const destination = { write: (line: string) => void lines.push(line) }
  const config = {
    ...loggerConfig.loggers.app,
    level: 'info',
    destination,
  } as ConstructorParameters<typeof Logger>[0]
  return { logger: new Logger(config), lines }
}

function fakeContext(logger: Logger) {
  return {
    logger,
    request: { id: () => 'req-123' },
    route: { pattern: ROUTE },
  } as unknown as HttpContext
}

// Erro real do PostgreSQL: violação de unicidade do tracking_token em pedido com dados pessoais
async function insertDuplicateToken(client: unknown) {
  const s = await setup()
  const created = await postOrder(
    client,
    s,
    newKey(),
    orderBody(s, { customer: { name: NAME, phone: PHONE }, notes: NOTES })
  )
  created.assertStatus(201)
  const token = created.body().data.tracking_token as string
  const row = await db.from('orders').where('restaurant_id', s.id).first()
  try {
    await db
      .table('orders')
      .insert({ ...row, id: randomUUID(), order_number: 9999, idempotency_key: randomUUID() })
  } catch (error) {
    return { error, token, s }
  }
  throw new Error('a inserção duplicada deveria falhar')
}

test.group('logs | redação', (group) => {
  group.each.setup(resetState)

  test('o erro bruto do banco carrega os dados sensíveis (premissa do teste)', async ({
    client,
    assert,
  }) => {
    const { error, token } = await insertDuplicateToken(client)
    const raw = JSON.stringify({
      message: (error as Error).message,
      detail: (error as { detail?: string }).detail,
    })
    assert.include(raw, token)
  })

  test('report: erro de banco sai só com propriedades permitidas e sem dados sensíveis', async ({
    client,
    assert,
  }) => {
    const { error, token } = await insertDuplicateToken(client)
    const { logger, lines } = memoryLogger()

    await new HttpExceptionHandler().report(error, fakeContext(logger))

    const output = lines.join('')
    assert.isNotEmpty(output)
    for (const secret of [token, PHONE, NAME, NOTES, 'tracking_token)=(']) {
      assert.notInclude(output, secret, `vazou: ${secret}`)
    }
    const entry = JSON.parse(lines[0])
    assert.equal(entry.level, 50)
    assert.equal(entry['x-request-id'], 'req-123')
    assert.equal(entry.route, ROUTE)
    assert.equal(entry.err.code, '23505')
    assert.equal(entry.err.constraint, 'orders_tracking_token_unique')
    assert.equal(entry.err.table, 'orders')
    assert.equal(entry.err.message, 'database error 23505')
    assert.deepEqual(Object.keys(entry.err).sort(), [
      'code',
      'constraint',
      'message',
      'name',
      'stack',
      'status',
      'table',
      'type',
    ])
  })

  test('sanitizeError não copia propriedades fora da lista nem texto de mensagem sensível', async ({
    assert,
  }) => {
    const token = 'a'.repeat(20) + 'B'.repeat(23)
    const error = Object.assign(
      new Error(`falha para "${NAME}" ${PHONE} maria@exemplo.com ${token} ${randomUUID()}`),
      { detail: `Key (x)=(${token})`, where: PHONE, parameters: [PHONE], status: 500 }
    )
    const logged = sanitizeError(error)
    const output = JSON.stringify(logged)
    for (const secret of [NAME, PHONE, 'maria@exemplo.com', token, 'Key (x)']) {
      assert.notInclude(output, secret, `vazou: ${secret}`)
    }
    assert.notProperty(logged, 'detail')
    assert.notProperty(logged, 'where')
    assert.notProperty(logged, 'parameters')
    assert.notInclude(logged.stack ?? '', 'falha para')
  })

  test('erro 4xx continua logado como antes: nível warn, só mensagem e request id', async ({
    assert,
  }) => {
    const { logger, lines } = memoryLogger()
    const error = Object.assign(new Error('Requisição inválida.'), { status: 404 })
    await new HttpExceptionHandler().report(error, fakeContext(logger))
    const entry = JSON.parse(lines[0])
    assert.equal(entry.level, 40)
    assert.equal(entry.msg, 'Requisição inválida.')
    assert.equal(entry['x-request-id'], 'req-123')
    assert.notProperty(entry, 'err')
  })

  test('status ignorados (400, 401, 422) continuam sem log', async ({ assert }) => {
    const { logger, lines } = memoryLogger()
    for (const status of [400, 401, 422]) {
      await new HttpExceptionHandler().report(
        Object.assign(new Error('x'), { status }),
        fakeContext(logger)
      )
    }
    assert.lengthOf(lines, 0)
  })
})

test.group('logs | redact do Pino na config real', () => {
  test('a config repassa redact ao Pino: campos proibidos saem como [Redacted]', async ({
    assert,
  }) => {
    assert.isAbove(REDACT_PATHS.length, 0)
    const { logger, lines } = memoryLogger()
    logger.info(
      {
        tracking_token: 'TOKEN-SECRETO',
        idempotency_key: 'KEY-SECRETA',
        password: 'senha-secreta',
        phone: PHONE,
        notes: NOTES,
        customer: { name: NAME, phone: PHONE },
        req: { headers: { cookie: 'sessao=abc', authorization: 'Bearer xyz' } },
        err: { detail: `Key (tracking_token)=(TOKEN-SECRETO)`, where: PHONE, parameters: [PHONE] },
        data: { tracking_token: 'TOKEN-SECRETO', phone: PHONE },
        ok: 'permanece',
      },
      'teste'
    )
    const output = lines.join('')
    for (const secret of [
      'TOKEN-SECRETO',
      'KEY-SECRETA',
      'senha-secreta',
      PHONE,
      NOTES,
      NAME,
      'sessao=abc',
      'Bearer xyz',
    ]) {
      assert.notInclude(output, secret, `vazou: ${secret}`)
    }
    const entry = JSON.parse(lines[0])
    assert.equal(entry.tracking_token, '[Redacted]')
    assert.equal(entry.data.phone, '[Redacted]')
    assert.equal(entry.ok, 'permanece')
  })
})

test.group('logs | requisições públicas', (group) => {
  group.each.setup(resetState)

  test('pedido, replay, cotação e acompanhamento (200, 404, 429) não logam dados sensíveis', async ({
    client,
    assert,
    cleanup,
  }) => {
    const captured: string[] = []
    const prototype = Logger.prototype as unknown as Record<string, (...args: unknown[]) => void>
    const methods = ['log', 'trace', 'debug', 'info', 'warn', 'error', 'fatal']
    const originals = methods.map((name) => prototype[name])
    methods.forEach((name) => {
      prototype[name] = (...args: unknown[]) => void captured.push(JSON.stringify(args))
    })
    cleanup(() => methods.forEach((name, index) => (prototype[name] = originals[index])))

    const s = await setup()
    const key = newKey()
    const payload = orderBody(s, { customer: { name: NAME, phone: PHONE }, notes: NOTES })
    const created = await postOrder(client, s, key, payload)
    created.assertStatus(201)
    const token = created.body().data.tracking_token as string
    ;(await postOrder(client, s, key, payload)).assertStatus(200)
    ;(await postOrder(client, s, newKey(), { ...payload, extra: 1 })).assertStatus(422)
    ;(
      await client
        .post(`/api/v1/public/restaurants/${s.slug}/cart/quote`)
        .json({ items: payload.items })
    ).assertStatus(200)
    ;(await client.get(`/api/v1/public/orders/${token}`)).assertStatus(200)
    ;(await client.get(`/api/v1/public/orders/${'x'.repeat(43)}`)).assertStatus(404)
    ;(await client.get('/api/v1/public/orders/curto')).assertStatus(404)

    const output = captured.join('\n')
    for (const secret of [
      token,
      key,
      PHONE,
      NAME,
      NOTES,
      `/public/orders/${token}`,
      'orders/curto',
      'x'.repeat(43),
    ]) {
      assert.notInclude(output, secret, `vazou: ${secret}`)
    }
  })
})
