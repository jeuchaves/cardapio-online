import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'order_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('restaurant_id').notNullable()
      table.uuid('order_id').notNullable()
      // Referência opcional: o snapshot abaixo é o que vale depois que o produto muda ou some
      table.uuid('product_id').nullable()
      table.string('product_name', 120).notNullable()
      table.decimal('unit_price', 10, 2).notNullable()
      table.integer('quantity').notNullable()
      // (unit_price + soma dos adicionais) × quantity, calculado no backend
      table.decimal('subtotal', 10, 2).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign(['order_id', 'restaurant_id'], 'order_items_order_restaurant_fk')
        .references(['id', 'restaurant_id'])
        .inTable('orders')
        .onDelete('RESTRICT')
      // Alvo da FK composta de order_item_addons
      table.unique(['id', 'restaurant_id'], { indexName: 'order_items_id_restaurant_unique' })
      table.index(['order_id'], 'order_items_order_index')
    })

    this.schema.raw(
      `ALTER TABLE order_items ADD CONSTRAINT order_items_product_restaurant_fk
         FOREIGN KEY (product_id, restaurant_id) REFERENCES products (id, restaurant_id)
         ON DELETE SET NULL (product_id)`
    )
    this.schema.raw(
      `ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check
         CHECK (quantity BETWEEN 1 AND 20)`
    )
    this.schema.raw(
      `ALTER TABLE order_items ADD CONSTRAINT order_items_prices_check
         CHECK (unit_price >= 0 AND subtotal >= 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
