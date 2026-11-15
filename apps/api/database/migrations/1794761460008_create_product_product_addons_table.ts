import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_product_addons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('product_id').notNullable()
      table.uuid('product_addon_id').notNullable()
      table.uuid('restaurant_id').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.primary(['product_id', 'product_addon_id'])

      // As duas FKs compartilham restaurant_id: produto e adicional só se associam dentro do
      // mesmo restaurante, mesmo que a API falhe. CASCADE: a associação é só configuração.
      table
        .foreign(['product_id', 'restaurant_id'], 'product_product_addons_product_fk')
        .references(['id', 'restaurant_id'])
        .inTable('products')
        .onDelete('CASCADE')
      table
        .foreign(['product_addon_id', 'restaurant_id'], 'product_product_addons_addon_fk')
        .references(['id', 'restaurant_id'])
        .inTable('product_addons')
        .onDelete('CASCADE')
      table.index(['product_addon_id'], 'product_product_addons_addon_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
