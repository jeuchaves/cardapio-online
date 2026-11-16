import { BaseSchema } from '@adonisjs/lucid/schema'

const STATUSES = "'pending','confirmed','preparing','ready','completed','cancelled'"

export default class extends BaseSchema {
  protected tableName = 'order_status_history'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('restaurant_id').notNullable()
      table.uuid('order_id').notNullable()
      // Nulo no registro de criação do pedido
      table.text('previous_status').nullable()
      table.text('new_status').notNullable()
      // Auditoria mínima; nulo na criação feita pelo cliente
      table
        .uuid('changed_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign(['order_id', 'restaurant_id'], 'order_status_history_order_restaurant_fk')
        .references(['id', 'restaurant_id'])
        .inTable('orders')
        .onDelete('RESTRICT')
      table.index(['order_id', 'created_at'], 'order_status_history_order_created_index')
    })

    this.schema.raw(
      `ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_status_check CHECK (
         new_status IN (${STATUSES})
         AND (previous_status IS NULL OR previous_status IN (${STATUSES})))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
