import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'order_item_addons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('restaurant_id').notNullable()
      table.uuid('order_item_id').notNullable()
      // Referência opcional: o snapshot abaixo é o que vale depois que o adicional muda ou some
      table.uuid('product_addon_id').nullable()
      table.string('addon_name', 80).notNullable()
      // Preço do adicional por unidade do item; sem quantity própria (usa a do item pai)
      table.decimal('unit_price', 10, 2).notNullable()
      // unit_price × quantity do item pai
      table.decimal('subtotal', 10, 2).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign(['order_item_id', 'restaurant_id'], 'order_item_addons_item_restaurant_fk')
        .references(['id', 'restaurant_id'])
        .inTable('order_items')
        .onDelete('RESTRICT')
      table.unique(['order_item_id', 'product_addon_id'], {
        indexName: 'order_item_addons_item_addon_unique',
      })
    })

    this.schema.raw(
      `ALTER TABLE order_item_addons ADD CONSTRAINT order_item_addons_addon_restaurant_fk
         FOREIGN KEY (product_addon_id, restaurant_id) REFERENCES product_addons (id, restaurant_id)
         ON DELETE SET NULL (product_addon_id)`
    )
    this.schema.raw(
      `ALTER TABLE order_item_addons ADD CONSTRAINT order_item_addons_prices_check
         CHECK (unit_price >= 0 AND subtotal >= 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
