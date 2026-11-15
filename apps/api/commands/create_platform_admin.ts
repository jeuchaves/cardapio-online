import vine from '@vinejs/vine'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

const validator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120),
  email: vine.string().trim().email().maxLength(254),
  password: vine.string().minLength(10).maxLength(128),
})

/**
 * Cria o primeiro platform_admin (F2-T2). Não existe senha padrão: a senha é digitada
 * sem eco, confirmada e guardada somente como hash. Nunca é impressa nem registrada em log.
 */
export default class CreatePlatformAdmin extends BaseCommand {
  static commandName = 'create:platform-admin'
  static description = 'Cria um usuário administrador da plataforma (platform_admin)'
  static options: CommandOptions = { startApp: true }

  async run() {
    // Import tardio: o model lê o serviço `hash`, que só existe depois que o app inicializa.
    // O ace carrega os comandos antes disso; importado no topo, o hash chega `undefined`.
    const { default: User } = await import('#models/user')

    const name = await this.prompt.ask('Nome')
    const email = await this.prompt.ask('E-mail')
    const password = await this.prompt.secure('Senha (10 a 128 caracteres)')
    const confirmation = await this.prompt.secure('Confirme a senha')

    if (password !== confirmation) {
      this.logger.error('As senhas não coincidem.')
      this.exitCode = 1
      return
    }

    let data
    try {
      data = await validator.validate({ name, email, password })
    } catch {
      this.logger.error('Dados inválidos: confira o nome, o e-mail e o tamanho da senha.')
      this.exitCode = 1
      return
    }

    const normalizedEmail = User.normalizeEmail(data.email)
    if (await User.findBy('email', normalizedEmail)) {
      this.logger.error('Já existe um usuário com este e-mail. Nada foi alterado.')
      this.exitCode = 1
      return
    }

    await User.create({
      name: data.name,
      email: normalizedEmail,
      password: data.password,
      isPlatformAdmin: true,
      mustChangePassword: false,
    })
    this.logger.success(`platform_admin criado: ${normalizedEmail}`)
  }
}
