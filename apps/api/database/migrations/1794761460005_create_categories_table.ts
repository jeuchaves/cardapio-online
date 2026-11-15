import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

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
      table.text('description').nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Alvo das FKs compostas de products: garante que a categoria é do mesmo restaurante
      table.unique(['id', 'restaurant_id'], { indexName: 'categories_id_restaurant_unique' })
      table.unique(['restaurant_id', 'name'], { indexName: 'categories_restaurant_name_unique' })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
