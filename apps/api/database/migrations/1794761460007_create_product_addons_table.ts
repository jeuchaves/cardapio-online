import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_addons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('restaurant_id')
        .notNullable()
        .references('id')
        .inTable('restaurants')
        .onDelete('RESTRICT')
      table.string('name', 80).notNullable()
      table.string('description', 500).nullable()
      table.decimal('price', 10, 2).notNullable()
      table.boolean('is_available').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Alvo das FKs compostas de product_product_addons
      table.unique(['id', 'restaurant_id'], { indexName: 'product_addons_id_restaurant_unique' })
      table.unique(['restaurant_id', 'name'], {
        indexName: 'product_addons_restaurant_name_unique',
      })
    })

    this.schema.raw(
      `ALTER TABLE product_addons ADD CONSTRAINT product_addons_price_check CHECK (price >= 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
