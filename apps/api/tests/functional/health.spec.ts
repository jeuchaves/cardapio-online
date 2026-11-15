import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { PostgreConfig } from '@adonisjs/lucid/types/database'

test.group('GET /api/v1/health', () => {
  test('responde 200 quando o banco está ativo', async ({ client, assert }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: { status: 'ok' } })
  })

  test('responde 503 sem detalhes internos quando o banco está indisponível', async ({
    client,
    assert,
    cleanup,
  }) => {
    const original = db.manager.get('pg')!.config as PostgreConfig
    cleanup(() => db.manager.patch('pg', original))

    // Porta sem servidor: a conexão é recusada.
    db.manager.patch('pg', {
      ...original,
      connection: { ...(original.connection as object), port: 1 },
    })

    const response = await client.get('/api/v1/health')

    response.assertStatus(503)
    assert.deepEqual(response.body(), {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço indisponível.',
    })
  })
})
