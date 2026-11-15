import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('restaurant_id')
        .notNullable()
        .references('id')
        .inTable('restaurants')
        .onDelete('RESTRICT')
      table.uuid('category_id').notNullable()
      table.string('name', 120).notNullable()
      table.string('description', 1000).nullable()
      table.decimal('price', 10, 2).notNullable()
      table.text('image').nullable()
      table.boolean('is_available').notNullable().defaultTo(true)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // FK composta: a categoria precisa ser do mesmo restaurante, garantido pelo banco
      table
        .foreign(['category_id', 'restaurant_id'], 'products_category_restaurant_fk')
        .references(['id', 'restaurant_id'])
        .inTable('categories')
        .onDelete('RESTRICT')
      table.unique(['id', 'restaurant_id'], { indexName: 'products_id_restaurant_unique' })
      table.index(['restaurant_id', 'category_id', 'sort_order'], 'products_menu_order_index')
    })

    this.schema.raw(`ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
