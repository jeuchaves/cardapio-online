import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'restaurants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 120).notNullable()
      table.string('slug', 60).notNullable().unique()
      table.string('description', 1000).nullable()
      table.string('phone', 20).nullable()
      table.text('logo').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('accepts_dine_in').notNullable().defaultTo(true)
      table.boolean('accepts_pickup').notNullable().defaultTo(true)
      table.boolean('accepts_cash').notNullable().defaultTo(true)
      table.boolean('accepts_card').notNullable().defaultTo(true)
      table.boolean('accepts_pix').notNullable().defaultTo(true)
      table.integer('next_order_number').notNullable().defaultTo(1001)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.raw(
      `ALTER TABLE restaurants
         ADD CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) >= 3),
         ADD CONSTRAINT restaurants_dine_modes CHECK (accepts_dine_in OR accepts_pickup),
         ADD CONSTRAINT restaurants_payment_methods CHECK (accepts_cash OR accepts_card OR accepts_pix)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
