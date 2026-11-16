import { BaseSchema } from '@adonisjs/lucid/schema'

const STATUSES = "'pending','confirmed','preparing','ready','completed','cancelled'"

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('restaurant_id')
        .notNullable()
        .references('id')
        .inTable('restaurants')
        .onDelete('RESTRICT')
      // Número sequencial por restaurante, atribuído na criação (restaurants.next_order_number)
      table.integer('order_number').notNullable()
      table.uuid('table_id').nullable()
      // Snapshot do nome da mesa: sobrevive à exclusão ou renomeação dela
      table.string('table_name', 60).nullable()
      table.string('customer_name', 120).notNullable()
      table.string('customer_phone', 20).nullable()
      table.text('fulfillment_type').notNullable()
      table.text('payment_method').notNullable()
      table.text('status').notNullable().defaultTo('pending')
      // Soma de order_items.subtotal, calculada no backend; não há subtotal, taxa nem desconto
      table.decimal('total', 10, 2).notNullable()
      table.string('notes', 500).nullable()
      table.text('tracking_token').notNullable().unique('orders_tracking_token_unique')
      table.uuid('idempotency_key').notNullable()
      table.text('idempotency_hash').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Alvo das FKs compostas de order_items e order_status_history
      table.unique(['id', 'restaurant_id'], { indexName: 'orders_id_restaurant_unique' })
      table.unique(['restaurant_id', 'order_number'], {
        indexName: 'orders_restaurant_order_number_unique',
      })
      table.unique(['restaurant_id', 'idempotency_key'], {
        indexName: 'orders_restaurant_idempotency_key_unique',
      })
    })

    // FK composta com SET NULL só na coluna de referência: restaurant_id (NOT NULL) é preservado.
    // O Knex não gera "SET NULL (coluna)", por isso a constraint vai em SQL.
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_table_restaurant_fk
         FOREIGN KEY (table_id, restaurant_id) REFERENCES restaurant_tables (id, restaurant_id)
         ON DELETE SET NULL (table_id)`
    )
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (${STATUSES}))`
    )
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_type_check
         CHECK (fulfillment_type IN ('dine_in','pickup'))`
    )
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
         CHECK (payment_method IN ('cash','card','pix'))`
    )
    this.schema.raw(`ALTER TABLE orders ADD CONSTRAINT orders_total_check CHECK (total >= 0)`)
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_phone_check
         CHECK (fulfillment_type = 'dine_in' OR customer_phone IS NOT NULL)`
    )
    // pickup não tem mesa; dine_in exige o snapshot. table_id pode virar nulo depois (SET NULL),
    // por isso não é exigido em dine_in.
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_table_check CHECK (
         (fulfillment_type = 'dine_in' AND table_name IS NOT NULL)
         OR (fulfillment_type = 'pickup' AND table_id IS NULL AND table_name IS NULL))`
    )
    this.schema.raw(
      `CREATE INDEX orders_restaurant_status_created_index
         ON orders (restaurant_id, status, created_at DESC)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
