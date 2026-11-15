import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import RestaurantTable from '#models/restaurant_table'
import {
  rejectBlankWhenPresent,
  rejectUnknownFields,
  uuidParam,
  validationError,
} from '#support/request_helpers'
import { createTable } from '#support/table_identifier'
import { createTableValidator, updateTableValidator } from '#validators/table'

// O identificador é gerado pelo servidor e nunca muda: não é aceito na entrada
const CREATE_FIELDS = ['name']
const UPDATE_FIELDS = ['name', 'is_active']

function findTable({ tenant, params }: HttpContext) {
  return RestaurantTable.query()
    .where('id', uuidParam(params.id))
    .where('restaurant_id', tenant.restaurantId)
    .first()
}

// Todas as rotas de mesas são do owner (middleware ownerOnly); o tenant vem do vínculo ativo.
export default class TablesController {
  async index({ tenant }: HttpContext) {
    const tables = await RestaurantTable.query()
      .where('restaurant_id', tenant.restaurantId)
      .orderBy([
        { column: 'name', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
    return { data: tables.map((table) => table.toApi()) }
  }

  async store({ request, response, tenant }: HttpContext) {
    rejectUnknownFields(request.body(), CREATE_FIELDS)
    const input = await request.validateUsing(createTableValidator)
    const table = await createTable(tenant.restaurantId, input.name)
    return response.status(201).send({ data: table.toApi() })
  }

  async update(ctx: HttpContext) {
    const { request, tenant } = ctx
    rejectUnknownFields(request.body(), UPDATE_FIELDS)
    rejectBlankWhenPresent(request.body(), ['name', 'is_active'])
    const table = await findTable(ctx)
    if (!table) throw ApiError.notFound()
    const input = await request.validateUsing(updateTableValidator)
    if (Object.keys(input).length === 0) throw validationError('body', 'Informe ao menos um campo.')

    const changes = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    }
    // O UPDATE também filtra por restaurant_id: o filtro do tenant não depende só da leitura anterior
    const updated = await db
      .from('restaurant_tables')
      .where('id', table.id)
      .where('restaurant_id', tenant.restaurantId)
      .update({ ...changes, updated_at: new Date() })
    if (Number(updated) === 0) throw ApiError.notFound()
    const fresh = await findTable(ctx)
    if (!fresh) throw ApiError.notFound()
    return { data: fresh.toApi() }
  }

  async destroy(ctx: HttpContext) {
    const deleted = await db
      .from('restaurant_tables')
      .where('id', uuidParam(ctx.params.id))
      .where('restaurant_id', ctx.tenant.restaurantId)
      .delete()
    if (Number(deleted) === 0) throw ApiError.notFound()
    return ctx.response.noContent()
  }
}
