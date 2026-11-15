import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import CreatePlatformAdmin from '../../commands/create_platform_admin.js'
import User from '#models/user'
import { createUser, resetState } from '#tests/helpers'

const SECRET = 'senha-secreta-do-admin-1'

async function run(answers: { name: string; email: string; password: string; confirm: string }) {
  const command = await ace.create(CreatePlatformAdmin, [])
  command.prompt.trap('Nome').replyWith(answers.name)
  command.prompt.trap('E-mail').replyWith(answers.email)
  command.prompt.trap('Senha (10 a 128 caracteres)').replyWith(answers.password)
  command.prompt.trap('Confirme a senha').replyWith(answers.confirm)
  await command.exec()
  return command
}

test.group('Comando create:platform-admin', (group) => {
  group.each.setup(resetState)
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('cria o administrador com hash e sem imprimir a senha', async ({ assert }) => {
    const command = await run({
      name: 'Admin',
      email: ' Admin@Exemplo.com ',
      password: SECRET,
      confirm: SECRET,
    })

    assert.equal(command.exitCode ?? 0, 0)
    const user = await User.findByOrFail('email', 'admin@exemplo.com')
    assert.isTrue(user.isPlatformAdmin)
    assert.isFalse(user.mustChangePassword)
    assert.notEqual(user.password, SECRET)
    assert.isTrue(await hash.verify(user.password, SECRET))

    const output = command.ui.logger.getLogs().map((log) => log.message)
    assert.isFalse(output.some((line) => line.includes(SECRET)))
  })

  test('e-mail existente: falha sem alterar nada', async ({ assert }) => {
    const existing = await createUser({ email: 'admin@exemplo.com' })
    const before = existing.password

    const command = await run({
      name: 'Outro',
      email: 'ADMIN@exemplo.com',
      password: SECRET,
      confirm: SECRET,
    })

    assert.equal(command.exitCode, 1)
    const users = await db.from('users').select('password', 'is_platform_admin')
    assert.lengthOf(users, 1)
    assert.equal(users[0].password, before)
    assert.isFalse(users[0].is_platform_admin)
  })

  test('rejeita confirmação diferente e senha curta', async ({ assert }) => {
    const mismatch = await run({
      name: 'A',
      email: 'a@exemplo.com',
      password: SECRET,
      confirm: 'diferente-de-tudo-1',
    })
    assert.equal(mismatch.exitCode, 1)

    const short = await run({
      name: 'A',
      email: 'a@exemplo.com',
      password: 'curta',
      confirm: 'curta',
    })
    assert.equal(short.exitCode, 1)

    assert.lengthOf(await db.from('users').select('id'), 0)
  })
})
