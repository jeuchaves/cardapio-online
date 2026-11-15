import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import {
  ORIGIN,
  PASSWORD,
  advanceClock,
  authed,
  createRestaurant,
  createUser,
  link,
  loginAndGetCookie,
  loginRequest,
  resetState,
  sessionCookie,
} from '#tests/helpers'

const HOUR = 60 * 60 * 1000

async function sessionRows(userId?: string) {
  const query = db.from('sessions')
  if (userId) query.where('user_id', userId)
  return query.select('*')
}

async function userWithRestaurant(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides)
  const restaurant = await createRestaurant()
  await link(user, restaurant, 'owner')
  return { user, restaurant }
}

test.group('Auth | login e sessão', (group) => {
  group.each.setup(resetState)

  test('1 e 2: login cria sessão no banco; cookie com flags corretas e só o identificador', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const response = await loginRequest(client, user.email)

    response.assertStatus(200)
    assert.equal(response.body().data.user.email, user.email)
    assert.lengthOf(response.body().data.restaurants, 1)
    assert.notProperty(response.body().data.user, 'password')

    const raw = response.headers()['set-cookie'] as unknown as string[]
    const header = raw.find((item) => item.startsWith('cardapio_session='))!
    assert.include(header, 'HttpOnly')
    assert.include(header, 'SameSite=Lax')
    assert.include(header, 'Path=/')
    assert.notInclude(header, 'Domain=')
    // Fora de produção o cookie não é Secure (a configuração usa app.inProduction)
    assert.notInclude(header, 'Secure')

    const cookie = decodeURIComponent(sessionCookie(response))
    assert.notInclude(cookie, user.id)
    assert.notInclude(cookie, user.email)

    const rows = await sessionRows(user.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].user_id, user.id)
  })

  test('login aceita e-mail com maiúsculas e espaços', async ({ client }) => {
    const { user } = await userWithRestaurant()
    const response = await loginRequest(client, `  ${user.email.toUpperCase()} `)
    response.assertStatus(200)
  })

  test('credenciais inválidas e usuário sem vínculo ativo respondem a mesma mensagem (D6)', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const noLink = await createUser()
    const inactiveLink = await createUser()
    await link(inactiveLink, await createRestaurant(), 'staff', false)

    const bodies = [
      await (await loginRequest(client, user.email, 'senha-errada-123')).body(),
      await (await loginRequest(client, 'ninguem@exemplo.com')).body(),
      await (await loginRequest(client, noLink.email)).body(),
      await (await loginRequest(client, inactiveLink.email)).body(),
    ]
    for (const body of bodies) {
      assert.equal(body.code, 'INVALID_CREDENTIALS')
      assert.deepEqual(body, bodies[0])
    }
    assert.lengthOf(await sessionRows(), 0)
  })

  test('platform_admin sem vínculo consegue entrar', async ({ client }) => {
    const admin = await createUser({ isPlatformAdmin: true })
    const response = await loginRequest(client, admin.email)
    response.assertStatus(200)
    response.assertBodyContains({ data: { restaurants: [] } })
  })

  test('3: login gera identificador novo e descarta o enviado antes (fixation)', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const first = await loginAndGetCookie(client, user.email)

    const second = await client
      .post('/api/v1/auth/login')
      .header('Origin', ORIGIN)
      .header('Cookie', first)
      .json({ email: user.email, password: PASSWORD })
    second.assertStatus(200)
    assert.notEqual(sessionCookie(second), first)
    // O cookie anterior não vale mais
    ;(await authed(client, 'get', '/api/v1/auth/me', first)).assertStatus(401)

    // Identificador forjado pelo atacante nunca vira a sessão autenticada
    const forged = await client
      .post('/api/v1/auth/login')
      .header('Origin', ORIGIN)
      .header('Cookie', 'cardapio_session=identificador-forjado')
      .json({ email: user.email, password: PASSWORD })
    forged.assertStatus(200)
    assert.notInclude(sessionCookie(forged), 'identificador-forjado')
  })

  test('4: inatividade acima do limite responde 401 e remove a linha', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)
    await db.from('sessions').update({ expires_at: new Date(Date.now() - 60_000) })

    ;(await authed(client, 'get', '/api/v1/auth/me', cookie)).assertStatus(401)
    assert.lengthOf(await sessionRows(), 0)
  })

  test('5 e 6: limite absoluto de 12h vale mesmo com atividade recente', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)

    let restore = () => {}
    try {
      // Atividade a cada 1h30 (dentro da inatividade de 2h) até 10h30
      for (let step = 1; step <= 7; step++) {
        restore()
        restore = advanceClock(step * 1.5 * HOUR)
        const response = await authed(client, 'get', '/api/v1/auth/me', cookie)
        response.assertStatus(200)
      }
      restore()
      restore = advanceClock(13.5 * HOUR)
      const response = await authed(client, 'get', '/api/v1/auth/me', cookie)
      response.assertStatus(401)
      response.assertBodyContains({ code: 'UNAUTHENTICATED' })
      assert.lengthOf(await sessionRows(), 0)
    } finally {
      restore()
    }
  })

  test('sessão sem login_at é inválida', async ({ client, assert }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)
    // Faz o middleware enxergar um relógio absurdo equivale a login_at ausente/vencido
    const restore = advanceClock(100 * HOUR)
    try {
      ;(await authed(client, 'get', '/api/v1/auth/me', cookie)).assertStatus(401)
    } finally {
      restore()
    }
    assert.lengthOf(await sessionRows(), 0)
  })

  test('7: logout apaga a sessão no servidor e o cookie copiado deixa de valer', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)

    ;(await authed(client, 'post', '/api/v1/auth/logout', cookie)).assertStatus(204)
    assert.lengthOf(await sessionRows(), 0)
    ;(await authed(client, 'get', '/api/v1/auth/me', cookie)).assertStatus(401)
  })

  test('logout sem sessão responde 401', async ({ client }) => {
    const response = await client.post('/api/v1/auth/logout').header('Origin', ORIGIN)
    response.assertStatus(401)
    response.assertBodyContains({ code: 'UNAUTHENTICATED' })
  })

  test('me devolve usuário e vínculos ativos', async ({ client, assert }) => {
    const { user, restaurant } = await userWithRestaurant()
    await link(user, await createRestaurant(), 'staff', false)
    const cookie = await loginAndGetCookie(client, user.email)

    const response = await authed(client, 'get', '/api/v1/auth/me', cookie)
    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.restaurants.map((r: { id: string }) => r.id),
      [restaurant.id]
    )
  })

  test('16: rota fora dos grupos de sessão não lê nem renova o cookie', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)
    const before = (await sessionRows(user.id))[0]

    const response = await client.get('/api/v1/health').header('Cookie', cookie)
    response.assertStatus(200)
    assert.notProperty(response.headers(), 'set-cookie')
    const after = (await sessionRows(user.id))[0]
    assert.equal(String(after.expires_at), String(before.expires_at))
  })
})

test.group('Auth | troca de senha', (group) => {
  group.each.setup(resetState)
  group.each.teardown(() => env.set('LIMITER_PASSWORD_PER_MINUTE', '1000'))

  const change = (client: Parameters<typeof authed>[0], cookie: string, body: object) =>
    authed(client, 'patch', '/api/v1/auth/password', cookie).json(body)

  test('8: rotaciona o identificador, preserva login_at e revoga as outras sessões', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    const cookieA = await loginAndGetCookie(client, user.email)
    const cookieB = await loginAndGetCookie(client, user.email)
    assert.lengthOf(await sessionRows(user.id), 2)

    let restore = () => {}
    try {
      for (let step = 1; step <= 7; step++) {
        restore()
        restore = advanceClock(step * 1.5 * HOUR)
        ;(await authed(client, 'get', '/api/v1/auth/me', cookieA)).assertStatus(200)
      }

      const response = await change(client, cookieA, {
        current_password: PASSWORD,
        new_password: 'outra-senha-forte-456',
      })
      response.assertStatus(204)
      const rotated = sessionCookie(response)
      assert.notEqual(rotated, cookieA)

      // Antigo e demais sessões morreram; a nova continua válida e etiquetada
      ;(await authed(client, 'get', '/api/v1/auth/me', cookieA)).assertStatus(401)
      ;(await authed(client, 'get', '/api/v1/auth/me', cookieB)).assertStatus(401)
      restore()
      restore = advanceClock(11.5 * HOUR)
      ;(await authed(client, 'get', '/api/v1/auth/me', rotated)).assertStatus(200)
      assert.lengthOf(await sessionRows(user.id), 1)

      // login_at preservado: 12h30 depois do login original, só 2h depois da rotação
      restore()
      restore = advanceClock(12.5 * HOUR)
      ;(await authed(client, 'get', '/api/v1/auth/me', rotated)).assertStatus(401)
    } finally {
      restore()
    }

    ;(await loginRequest(client, user.email)).assertStatus(401)
    ;(await loginRequest(client, user.email, 'outra-senha-forte-456')).assertStatus(200)
  })

  test('valida a política de senha', async ({ client }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)

    const cases: Array<[object, string]> = [
      [
        { current_password: 'errada-errada-1', new_password: 'outra-senha-forte-456' },
        'current_password',
      ],
      [{ current_password: PASSWORD, new_password: PASSWORD }, 'new_password'],
      [{ current_password: PASSWORD, new_password: user.email }, 'new_password'],
      [{ current_password: PASSWORD, new_password: 'curta' }, 'new_password'],
      [{ current_password: PASSWORD, new_password: 'a'.repeat(129) }, 'new_password'],
    ]
    for (const [body] of cases) {
      const response = await change(client, cookie, body)
      response.assertStatus(422)
      response.assertBodyContains({ code: 'VALIDATION_ERROR' })
    }
    // Sem regras de composição: 10 letras minúsculas servem
    ;(
      await change(client, cookie, { current_password: PASSWORD, new_password: 'abcdefghij' })
    ).assertStatus(204)
  })

  test('senha temporária: tudo é bloqueado exceto troca de senha e logout', async ({ client }) => {
    const { user } = await userWithRestaurant({ mustChangePassword: true })
    const login = await loginRequest(client, user.email)
    login.assertStatus(200)
    login.assertBodyContains({ data: { user: { must_change_password: true } } })
    const cookie = sessionCookie(login)

    const blocked = await authed(client, 'get', '/api/v1/auth/me', cookie)
    blocked.assertStatus(403)
    blocked.assertBodyContains({ code: 'PASSWORD_CHANGE_REQUIRED' })

    const changed = await change(client, cookie, {
      current_password: PASSWORD,
      new_password: 'outra-senha-forte-456',
    })
    changed.assertStatus(204)
    ;(await authed(client, 'get', '/api/v1/auth/me', sessionCookie(changed))).assertStatus(200)
  })

  test('troca de senha excedendo o limite responde 429', async ({ client }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)
    env.set('LIMITER_PASSWORD_PER_MINUTE', '5')
    for (let i = 0; i < 5; i++) {
      ;(
        await change(client, cookie, {
          current_password: 'errada-errada-1',
          new_password: 'x'.repeat(12),
        })
      ).assertStatus(422)
    }
    const response = await change(client, cookie, {
      current_password: 'errada-errada-1',
      new_password: 'x'.repeat(12),
    })
    response.assertStatus(429)
    response.assertBodyContains({ code: 'RATE_LIMITED' })
  })
})

test.group('Auth | origem (CSRF) e rate limit', (group) => {
  group.each.setup(resetState)

  test('13: login sem Origin válido responde 403 (login CSRF)', async ({ client, assert }) => {
    const { user } = await userWithRestaurant()
    const payload = { email: user.email, password: PASSWORD }

    const noOrigin = await client.post('/api/v1/auth/login').json(payload)
    noOrigin.assertStatus(403)
    noOrigin.assertBodyContains({ code: 'FORBIDDEN' })

    for (const origin of ['', 'null', 'https://atacante.example']) {
      const response = await client
        .post('/api/v1/auth/login')
        .header('Origin', origin)
        .json(payload)
      response.assertStatus(403)
    }
    assert.lengthOf(await sessionRows(), 0)
  })

  test('14: métodos seguros não exigem Origin', async ({ client }) => {
    const { user } = await userWithRestaurant()
    const cookie = await loginAndGetCookie(client, user.email)
    ;(await client.get('/api/v1/auth/me').header('Cookie', cookie)).assertStatus(200)
  })

  test('17: login excedendo 5/min por IP e e-mail responde 429 com Retry-After', async ({
    client,
    assert,
  }) => {
    const { user } = await userWithRestaurant()
    for (let i = 0; i < 5; i++) {
      ;(await loginRequest(client, user.email, 'senha-errada-123')).assertStatus(401)
    }
    const blocked = await loginRequest(client, user.email)
    blocked.assertStatus(429)
    blocked.assertBodyContains({ code: 'RATE_LIMITED' })
    assert.property(blocked.headers(), 'retry-after')

    // E-mail diferente tem contador próprio
    const other = await userWithRestaurant()
    ;(await loginRequest(client, other.user.email)).assertStatus(200)
  })

  test('D3: limite por IP é independente do e-mail', async ({ client }) => {
    const original = env.get('LIMITER_LOGIN_IP_PER_MINUTE')
    env.set('LIMITER_LOGIN_IP_PER_MINUTE', '3')
    try {
      for (let i = 0; i < 3; i++) {
        ;(await loginRequest(client, `nao-existe-${i}@exemplo.com`)).assertStatus(401)
      }
      ;(await loginRequest(client, 'nao-existe-9@exemplo.com')).assertStatus(429)
    } finally {
      env.set('LIMITER_LOGIN_IP_PER_MINUTE', String(original))
    }
  })
})
