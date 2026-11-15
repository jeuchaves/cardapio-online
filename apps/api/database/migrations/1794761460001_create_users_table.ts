import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 120).notNullable()
      table.string('email', 254).notNullable()
      table.text('password').notNullable()
      table.boolean('is_platform_admin').notNullable().defaultTo(false)
      table.boolean('must_change_password').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // E-mail único sem distinção entre maiúsculas e minúsculas.
    this.schema.raw('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
