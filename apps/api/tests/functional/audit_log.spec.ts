import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import type { Assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import {
  authed,
  createRestaurant,
  createRestaurantWithTeam,
  createUser,
  link,
  loginAndGetCookie,
  resetState,
} from '#tests/helpers'

// F6-T1: CLAUDE.md seção 9 e ROADMAP seção 6 (Auditoria). Toda ação administrativa crítica gera
// exatamente um log estruturado com ator, ação e recurso, e nada além disso.

type Audit = {
  audit: true
  actor_id: string
  action: string
  resource_type: string
  resource_id: string
}

const AUDIT_KEYS = ['action', 'actor_id', 'audit', 'resource_id', 'resource_type']

// Captura o que a aplicação registra em logger.info durante a ação e devolve as auditorias
// (e o texto completo, para conferir que nenhum dado pessoal foi junto).
async function captured(action: () => Promise<unknown>) {
  const calls: unknown[][] = []
  const original = logger.info
  logger.info = ((...args: unknown[]) => {
    calls.push(args)
  }) as typeof logger.info
  try {
    await action()
  } finally {
    logger.info = original
  }
  const audits = calls
    .map(([data]) => data as Partial<Audit> | undefined)
    .filter((data): data is Audit => data?.audit === true)
  return { audits, text: JSON.stringify(calls) }
}

function assertOnlyAllowedKeys(assert: Assert, audits: Audit[]) {
  for (const entry of audits) assert.deepEqual(Object.keys(entry).sort(), AUDIT_KEYS)
}

const storageRoot = () => app.makePath('tmp/test-storage')
const tmpUploads = () => app.tmpPath('uploads')

async function resetStorage() {
  await resetState()
  await rm(storageRoot(), { recursive: true, force: true })
  await rm(tmpUploads(), { recursive: true, force: true })
}

function png(size = 64) {
  const buffer = Buffer.alloc(size, 0x22)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  return buffer
}

test.group('Auditoria | plataforma', (group) => {
  group.each.setup(resetState)

  test('cadastro, vínculo, edição, ativação e reset de senha geram um log cada, sem dados pessoais', async ({
    client,
    assert,
  }) => {
    const admin = await createUser({ isPlatformAdmin: true })
    const cookie = await loginAndGetCookie(client, admin.email)
    const url = '/api/v1/platform/restaurants'

    // Cadastro com owner novo: restaurante e usuário
    let id = ''
    let ownerId = ''
    let temporaryPassword = ''
    const created = await captured(async () => {
      const response = await authed(client, 'post', url, cookie).json({
        name: 'Casa do Sabor',
        slug: 'casa-do-sabor',
        phone: '11999990000',
        owner: { name: 'Maria Dona', email: 'maria@exemplo.com' },
      })
      response.assertStatus(201)
      id = response.body().data.restaurant.id
      ownerId = response.body().data.owner.id
      temporaryPassword = response.body().data.owner.temporary_password
    })
    assert.deepEqual(
      created.audits.map((a) => [a.action, a.resource_type, a.resource_id]),
      [
        ['restaurant.create', 'restaurant', id],
        ['user.create_owner', 'user', ownerId],
      ]
    )
    assert.isTrue(created.audits.every((a) => a.actor_id === admin.id))
    assertOnlyAllowedKeys(assert, created.audits)

    // Cadastro vinculando um usuário existente (com confirmação)
    const existing = await createUser({ email: 'joao@exemplo.com', name: 'João Existente' })
    let linkedRestaurantId = ''
    const linked = await captured(async () => {
      const response = await authed(client, 'post', url, cookie).json({
        name: 'Outro Lugar',
        slug: 'outro-lugar',
        owner: { name: 'João Existente', email: 'joao@exemplo.com' },
        confirm_link_existing_user: true,
      })
      response.assertStatus(201)
      linkedRestaurantId = response.body().data.restaurant.id
    })
    assert.deepEqual(
      linked.audits.map((a) => [a.action, a.resource_id]),
      [
        ['restaurant.create', linkedRestaurantId],
        ['user.link_owner', existing.id],
      ]
    )
    assertOnlyAllowedKeys(assert, linked.audits)

    // Edição, desativação, ativação e reset de senha: uma auditoria por ação
    const steps: Array<[string, () => Promise<unknown>, string, string]> = [
      [
        'restaurant.update',
        async () =>
          (
            await authed(client, 'patch', `${url}/${id}`, cookie).json({ name: 'Novo Nome' })
          ).assertStatus(200),
        'restaurant',
        id,
      ],
      [
        'restaurant.deactivate',
        async () =>
          (
            await authed(client, 'patch', `${url}/${id}/status`, cookie).json({ is_active: false })
          ).assertStatus(200),
        'restaurant',
        id,
      ],
      [
        'restaurant.activate',
        async () =>
          (
            await authed(client, 'patch', `${url}/${id}/status`, cookie).json({ is_active: true })
          ).assertStatus(200),
        'restaurant',
        id,
      ],
      [
        'user.reset_password',
        async () =>
          (await authed(client, 'post', `${url}/${id}/owner/reset-password`, cookie)).assertStatus(
            200
          ),
        'user',
        ownerId,
      ],
    ]
    const all = [created.text, linked.text]
    for (const [action, run, type, resourceId] of steps) {
      const result = await captured(run)
      assert.lengthOf(result.audits, 1, action)
      assert.deepEqual(
        [result.audits[0].action, result.audits[0].resource_type, result.audits[0].resource_id],
        [action, type, resourceId]
      )
      assert.equal(result.audits[0].actor_id, admin.id)
      assertOnlyAllowedKeys(assert, result.audits)
      all.push(result.text)
    }

    const text = all.join('\n')
    for (const secret of [
      temporaryPassword,
      'maria@exemplo.com',
      'joao@exemplo.com',
      '11999990000',
    ]) {
      assert.notInclude(text, secret, `vazou: ${secret}`)
    }
  })

  test('ações recusadas ou inválidas não geram auditoria', async ({ client, assert }) => {
    const admin = await createUser({ isPlatformAdmin: true })
    const cookie = await loginAndGetCookie(client, admin.email)
    const restaurant = await createRestaurant()
    const url = '/api/v1/platform/restaurants'
    // Usuário comum (dono de outro restaurante): autenticado, mas sem perfil de plataforma
    const outsider = (await createRestaurantWithTeam()).owner
    const outsiderCookie = await loginAndGetCookie(client, outsider.email)

    const result = await captured(async () => {
      // Dados inválidos e slug reservado/duplicado
      ;(await authed(client, 'post', url, cookie).json({ name: '' })).assertStatus(422)
      ;(
        await authed(client, 'patch', `${url}/${restaurant.id}/status`, cookie).json({
          is_active: 'talvez',
        })
      ).assertStatus(422)
      // Recurso inexistente e usuário sem perfil de plataforma
      ;(
        await authed(client, 'patch', `${url}/00000000-0000-4000-8000-000000000000`, cookie).json({
          name: 'x',
        })
      ).assertStatus(404)
      ;(
        await authed(client, 'patch', `${url}/${restaurant.id}/status`, outsiderCookie).json({
          is_active: false,
        })
      ).assertStatus(403)
    })
    assert.lengthOf(result.audits, 0)
  })
})

test.group('Auditoria | restaurante e equipe', (group) => {
  group.each.setup(resetStorage)
  group.teardown(resetStorage)

  test('dados, configurações, logo e equipe geram um log cada, sem dados pessoais', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner } = await createRestaurantWithTeam()
    const cookie = await loginAndGetCookie(client, owner.email)
    const base = `/api/v1/tenant/${restaurant.id}`

    let staffId = ''
    let temporaryPassword = ''
    const steps: Array<[string, () => Promise<unknown>, string, () => string]> = [
      [
        'restaurant.update',
        async () =>
          (
            await authed(client, 'patch', `${base}/restaurant`, cookie).json({
              phone: '11988887777',
            })
          ).assertStatus(200),
        'restaurant',
        () => restaurant.id,
      ],
      [
        'restaurant.update_settings',
        async () =>
          (
            await authed(client, 'patch', `${base}/restaurant/settings`, cookie).json({
              accepts_pix: false,
            })
          ).assertStatus(200),
        'restaurant',
        () => restaurant.id,
      ],
      [
        'restaurant.update_logo',
        async () =>
          (
            await authed(client, 'put', `${base}/restaurant/logo`, cookie).file('file', png(), {
              filename: 'logo.png',
              contentType: 'image/png',
            })
          ).assertStatus(200),
        'restaurant',
        () => restaurant.id,
      ],
      [
        'staff.create',
        async () => {
          const response = await authed(client, 'post', `${base}/staff`, cookie).json({
            name: 'Atendente Novo',
            email: 'atendente.novo@exemplo.com',
          })
          response.assertStatus(201)
          staffId = response.body().data.id
          temporaryPassword = response.body().data.temporary_password
        },
        'user',
        () => staffId,
      ],
      [
        'staff.deactivate',
        async () =>
          (
            await authed(client, 'patch', `${base}/staff/${staffId}`, cookie).json({
              is_active: false,
            })
          ).assertStatus(200),
        'user',
        () => staffId,
      ],
      [
        'staff.activate',
        async () =>
          (
            await authed(client, 'patch', `${base}/staff/${staffId}`, cookie).json({
              is_active: true,
            })
          ).assertStatus(200),
        'user',
        () => staffId,
      ],
      [
        'staff.reset_password',
        async () =>
          (
            await authed(client, 'post', `${base}/staff/${staffId}/reset-password`, cookie)
          ).assertStatus(200),
        'user',
        () => staffId,
      ],
    ]

    const texts: string[] = []
    for (const [action, run, type, resourceId] of steps) {
      const result = await captured(run)
      assert.lengthOf(result.audits, 1, action)
      assert.deepEqual(
        [result.audits[0].action, result.audits[0].resource_type, result.audits[0].resource_id],
        [action, type, resourceId()]
      )
      assert.equal(result.audits[0].actor_id, owner.id)
      assertOnlyAllowedKeys(assert, result.audits)
      texts.push(result.text)
    }

    const text = texts.join('\n')
    for (const secret of [
      temporaryPassword,
      'atendente.novo@exemplo.com',
      'Atendente Novo',
      '11988887777',
    ]) {
      assert.notInclude(text, secret, `vazou: ${secret}`)
    }
  })

  test('staff recusado, validação e outro restaurante não geram auditoria', async ({
    client,
    assert,
  }) => {
    const { restaurant, owner, staff } = await createRestaurantWithTeam()
    const other = await createRestaurantWithTeam()
    const ownerCookie = await loginAndGetCookie(client, owner.email)
    const staffCookie = await loginAndGetCookie(client, staff.email)
    const base = `/api/v1/tenant/${restaurant.id}`
    const otherBase = `/api/v1/tenant/${other.restaurant.id}`
    const otherStaff = await createUser()
    await link(otherStaff, other.restaurant, 'staff')

    const result = await captured(async () => {
      ;(
        await authed(client, 'patch', `${base}/restaurant`, staffCookie).json({ name: 'x' })
      ).assertStatus(403)
      ;(
        await authed(client, 'post', `${base}/staff`, staffCookie).json({
          name: 'x',
          email: 'x@exemplo.com',
        })
      ).assertStatus(403)
      // Nenhuma modalidade habilitada: inválido
      ;(
        await authed(client, 'patch', `${base}/restaurant/settings`, ownerCookie).json({
          accepts_dine_in: false,
          accepts_pickup: false,
        })
      ).assertStatus(422)
      // Restaurante e equipe de B pelo dono de A
      ;(
        await authed(client, 'patch', `${otherBase}/restaurant`, ownerCookie).json({ name: 'x' })
      ).assertStatus(404)
      ;(
        await authed(client, 'patch', `${otherBase}/staff/${otherStaff.id}`, ownerCookie).json({
          is_active: false,
        })
      ).assertStatus(404)
      ;(
        await authed(client, 'post', `${base}/staff/${otherStaff.id}/reset-password`, ownerCookie)
      ).assertStatus(404)
    })
    assert.lengthOf(result.audits, 0)
  })
})
