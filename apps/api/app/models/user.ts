import { UserSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

export default class User extends compose(
  UserSchema,
  withAuthFinder(hash, { uids: ['email'], passwordColumnName: 'password' })
) {
  /**
   * E-mail é sempre guardado e consultado em minúsculas, sem espaços nas pontas.
   */
  static normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }
}
