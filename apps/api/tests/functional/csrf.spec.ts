import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import hash from '@adonisjs/core/services/hash'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import User from '#models/user'
import OriginMiddleware, { normalizeOrigin } from '#middleware/origin_middleware'
import {
  ORIGIN,
  PASSWORD,
  createRestaurant,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'

async function passes(method: string, origin: string | undefined) {
  const ctx = {
    request: {
      method: () => method,
      header: (name: string) => (name.toLowerCase() === 'origin' ? origin : undefined),
    },
  } as unknown as HttpContext
  try {
    await new OriginMiddleware().handle(ctx, async () => undefined)
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return false
    throw error
  }
}

test.group('CSRF | middleware de Origin', () => {
  test('10: todo método que altera estado exige a origem exata', async ({ assert }) => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.isTrue(await passes(method, ORIGIN), `${method} com Origin correto`)
      for (const bad of [undefined, '', 'null', 'https://atacante.example']) {
        assert.isFalse(await passes(method, bad), `${method} com Origin ${String(bad)}`)
      }
    }
  })

  test('11: comparação exata, sem prefixo, sufixo, subdomínio, esquema, porta ou caminho', async ({
    assert,
  }) => {
    const rejected = [
      'http://app.localhost:3000',
      'http://localhost:3000.atacante.com',
      'http://localhost.atacante.com:3000',
      'https://localhost:3000',
      'http://localhost:3001',
      'http://localhost',
      'http://localhost:3000/painel',
      'http://localhost:3000/',
      'HTTP://LOCALHOST:3000',
      ` ${ORIGIN}`,
    ]
    for (const origin of rejected) {
      assert.isFalse(await passes('POST', origin), origin)
    }
  })

  test('11: APP_URL é normalizado (esquema e host em minúsculas, sem caminho e porta padrão)', async ({
    assert,
  }) => {
    assert.equal(
      normalizeOrigin('HTTPS://Cardapio.Exemplo.com:443/painel/'),
      'https://cardapio.exemplo.com'
    )
    assert.equal(normalizeOrigin('http://localhost:3000/'), 'http://localhost:3000')
  })

  test('14: métodos seguros não exigem Origin', async ({ assert }) => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      assert.isTrue(await passes(method, undefined))
    }
  })
})

test.group('CSRF | rotas autenticadas', (group) => {
  group.each.setup(resetState)

  test('POST e PATCH com Origin inválido ou só com Referer: 403 sem alterar dados', async ({
    client,
    assert,
  }) => {
    const user = await createUser()
    await link(user, await createRestaurant(), 'owner')
    const cookie = await loginAndGetCookie(client, user.email)
    const before = (await User.findOrFail(user.id)).password

    const attempts = [
      { Origin: 'https://atacante.example' },
      { Origin: 'null' },
      { Origin: '' },
      // 12: Referer correto, sem Origin, continua recusado
      { Referer: `${ORIGIN}/painel` },
      {},
    ]
    for (const headers of attempts) {
      const patch = client
        .patch('/api/v1/auth/password')
        .header('Cookie', cookie)
        .json({ current_password: PASSWORD, new_password: 'outra-senha-forte-456' })
      const post = client.post('/api/v1/auth/logout').header('Cookie', cookie)
      for (const [name, value] of Object.entries(headers)) {
        patch.header(name, value)
        post.header(name, value)
      }
      ;(await patch).assertStatus(403)
      ;(await post).assertStatus(403)
    }

    const after = await User.findOrFail(user.id)
    assert.equal(after.password, before)
    assert.isTrue(await hash.verify(after.password, PASSWORD))
    // A sessão continua válida: o logout recusado não a encerrou
    ;(await client.get('/api/v1/auth/me').header('Cookie', cookie)).assertStatus(200)
  })
})

test.group('CSRF | tabela de rotas', () => {
  test('15: toda rota que altera estado, fora de /public, tem o middleware de Origin', async ({
    assert,
  }) => {
    const routes = Object.values(router.toJSON()).flat()
    const unsafe = routes.filter((route) =>
      route.methods.some((method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
    )
    assert.isAbove(unsafe.length, 0)

    const missing = unsafe
      .filter((route) => !route.pattern.startsWith('/api/v1/public'))
      .filter((route) => !middlewareNames(route).includes('origin'))
      .map((route) => `${route.methods.join(',')} ${route.pattern}`)
    assert.deepEqual(missing, [])
  })

  test('16: rotas fora dos grupos protegidos não registram sessão nem autenticação', async ({
    assert,
  }) => {
    const routes = Object.values(router.toJSON()).flat()
    const sessionRoutes = ['/api/v1/auth', '/api/v1/platform', '/api/v1/tenant']
    const offenders = routes
      .filter((route) => !sessionRoutes.some((prefix) => route.pattern.startsWith(prefix)))
      .filter((route) =>
        middlewareNames(route).some((name) => ['session', 'initializeAuth', 'auth'].includes(name))
      )
      .map((route) => route.pattern)
    assert.deepEqual(offenders, [])
  })

  test('toda rota de /platform e /tenant exige autenticação e troca de senha concluída', async ({
    assert,
  }) => {
    const routes = Object.values(router.toJSON())
      .flat()
      .filter(
        (route) =>
          route.pattern.startsWith('/api/v1/platform') || route.pattern.startsWith('/api/v1/tenant')
      )
    assert.isAbove(routes.length, 0)

    for (const route of routes) {
      const names = middlewareNames(route)
      for (const required of ['session', 'auth', 'absoluteSession', 'passwordChange']) {
        assert.include(names, required, `${route.pattern} sem ${required}`)
      }
      const scope = route.pattern.startsWith('/api/v1/platform') ? 'platformAdmin' : 'tenant'
      assert.include(names, scope, `${route.pattern} sem ${scope}`)
    }
  })
})

function middlewareNames(route: { middleware: { all(): Iterable<unknown> } }) {
  return [...route.middleware.all()].map((item) => (item as { name?: string }).name ?? '')
}
