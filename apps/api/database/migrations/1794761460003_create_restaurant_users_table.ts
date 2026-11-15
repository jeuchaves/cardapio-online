import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'restaurant_users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('restaurant_id')
        .notNullable()
        .references('id')
        .inTable('restaurants')
        .onDelete('RESTRICT')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT')
      table.string('role', 10).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['restaurant_id', 'user_id'])
      table.index(['user_id'])
    })

    this.schema.raw(
      `ALTER TABLE restaurant_users ADD CONSTRAINT restaurant_users_role CHECK (role IN ('owner', 'staff'))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
