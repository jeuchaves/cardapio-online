import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'restaurant_tables'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('restaurant_id')
        .notNullable()
        .references('id')
        .inTable('restaurants')
        .onDelete('RESTRICT')
      table.string('name', 60).notNullable()
      // Código aleatório usado no QR Code; contexto do pedido, não autenticação
      table.text('identifier').notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Alvo da FK composta de orders (Fase 5)
      table.unique(['id', 'restaurant_id'], { indexName: 'restaurant_tables_id_restaurant_unique' })
      table.unique(['restaurant_id', 'identifier'], {
        indexName: 'restaurant_tables_restaurant_identifier_unique',
      })
    })

    this.schema.raw(
      `ALTER TABLE restaurant_tables ADD CONSTRAINT restaurant_tables_identifier_check CHECK (identifier ~ '^[a-z0-9]{10}$')`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
