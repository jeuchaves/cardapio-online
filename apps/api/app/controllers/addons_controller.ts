import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import ProductAddon from '#models/product_addon'
import { parsePrice } from '#support/money'
import {
  isUniqueViolation,
  rejectBlankWhenPresent,
  rejectUnknownFields,
  uuidParam,
  validationError,
} from '#support/request_helpers'
import { createAddonValidator, updateAddonValidator } from '#validators/addon'

const FIELDS = ['name', 'description', 'price', 'is_available']
const NAME_UNIQUE = 'product_addons_restaurant_name_unique'

const nameTaken = () =>
  new ApiError(409, 'ADDON_NAME_TAKEN', 'Já existe um adicional com este nome.')

/** is_available é campo do owner (D8): staff que o envia recebe 403, mesmo com valor igual. */
function assertCanSetAvailability({ tenant, request }: HttpContext) {
  if (tenant.role !== 'owner' && 'is_available' in request.body()) throw ApiError.forbidden()
}

function findAddon({ tenant, params }: HttpContext) {
  return ProductAddon.query()
    .where('id', uuidParam(params.id))
    .where('restaurant_id', tenant.restaurantId)
    .first()
}

export default class AddonsController {
  async index({ tenant }: HttpContext) {
    const addons = await ProductAddon.query()
      .where('restaurant_id', tenant.restaurantId)
      .orderBy([
        { column: 'name', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
    return { data: addons.map((addon) => addon.toApi()) }
  }

  async store(ctx: HttpContext) {
    const { request, response, tenant } = ctx
    rejectUnknownFields(request.body(), FIELDS)
    assertCanSetAvailability(ctx)
    rejectBlankWhenPresent(request.body(), ['is_available'])
    const input = await request.validateUsing(createAddonValidator)
    const price = parsePrice(input.price)

    try {
      const addon = await ProductAddon.create({
        restaurantId: tenant.restaurantId,
        name: input.name,
        description: input.description ?? null,
        price,
        isAvailable: input.is_available ?? true,
      })
      return response.status(201).send({ data: addon.toApi() })
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE)) throw nameTaken()
      throw error
    }
  }

  async update(ctx: HttpContext) {
    const { request, tenant } = ctx
    rejectUnknownFields(request.body(), FIELDS)
    assertCanSetAvailability(ctx)
    rejectBlankWhenPresent(request.body(), ['name', 'price', 'is_available'])
    const addon = await findAddon(ctx)
    if (!addon) throw ApiError.notFound()
    const input = await request.validateUsing(updateAddonValidator)
    if (Object.keys(input).length === 0) throw validationError('body', 'Informe ao menos um campo.')

    const price = input.price !== undefined ? parsePrice(input.price) : undefined
    const changes = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(price !== undefined && { price }),
      ...(input.is_available !== undefined && { is_available: input.is_available }),
    }
    // O UPDATE tambem filtra por restaurant_id: o filtro do tenant nao depende so da leitura anterior
    try {
      const updated = await db
        .from('product_addons')
        .where('id', addon.id)
        .where('restaurant_id', tenant.restaurantId)
        .update({ ...changes, updated_at: new Date() })
      if (Number(updated) === 0) throw ApiError.notFound()
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE)) throw nameTaken()
      throw error
    }
    const fresh = await findAddon(ctx)
    if (!fresh) throw ApiError.notFound()
    return { data: fresh.toApi() }
  }

  async destroy(ctx: HttpContext) {
    // As associações com produtos saem por ON DELETE CASCADE
    const deleted = await db
      .from('product_addons')
      .where('id', uuidParam(ctx.params.id))
      .where('restaurant_id', ctx.tenant.restaurantId)
      .delete()
    if (Number(deleted) === 0) throw ApiError.notFound()
    return ctx.response.noContent()
  }
}
