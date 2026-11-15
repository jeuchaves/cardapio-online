import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import Category from '#models/category'
import {
  isForeignKeyViolation,
  isUniqueViolation,
  rejectBlankWhenPresent,
  rejectUnknownFields,
  uuidParam,
  validationError,
} from '#support/request_helpers'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

const FIELDS = ['name', 'description', 'sort_order', 'is_active']

const nameTaken = () =>
  new ApiError(409, 'CATEGORY_NAME_TAKEN', 'Já existe uma categoria com este nome.')

/** Categoria do restaurante validado pelo middleware; de outro restaurante, é 404. */
function findCategory({ tenant, params }: HttpContext) {
  return Category.query()
    .where('id', uuidParam(params.id))
    .where('restaurant_id', tenant.restaurantId)
    .first()
}

/** is_active é campo do owner (D8): staff que o envia recebe 403, mesmo com valor igual. */
function assertCanSetActive({ tenant, request }: HttpContext) {
  if (tenant.role !== 'owner' && 'is_active' in request.body()) throw ApiError.forbidden()
}

export default class CategoriesController {
  async index({ tenant }: HttpContext) {
    const categories = await Category.query()
      .where('restaurant_id', tenant.restaurantId)
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'name', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
    return { data: categories.map((category) => category.toApi()) }
  }

  async store(ctx: HttpContext) {
    const { request, response, tenant } = ctx
    rejectUnknownFields(request.body(), FIELDS)
    assertCanSetActive(ctx)
    rejectBlankWhenPresent(request.body(), ['sort_order', 'is_active'])
    const input = await request.validateUsing(createCategoryValidator)

    try {
      const category = await Category.create({
        restaurantId: tenant.restaurantId,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sort_order ?? 0,
        isActive: input.is_active ?? true,
      })
      return response.status(201).send({ data: category.toApi() })
    } catch (error) {
      if (isUniqueViolation(error, 'categories_restaurant_name_unique')) throw nameTaken()
      throw error
    }
  }

  async update(ctx: HttpContext) {
    const { request, tenant } = ctx
    rejectUnknownFields(request.body(), FIELDS)
    assertCanSetActive(ctx)
    rejectBlankWhenPresent(request.body(), ['name', 'sort_order', 'is_active'])
    const category = await findCategory(ctx)
    if (!category) throw ApiError.notFound()
    const input = await request.validateUsing(updateCategoryValidator)
    if (Object.keys(input).length === 0) throw validationError('body', 'Informe ao menos um campo.')

    const changes = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    }
    // O UPDATE tambem filtra por restaurant_id: o filtro do tenant nao depende so da leitura anterior
    try {
      const updated = await db
        .from('categories')
        .where('id', category.id)
        .where('restaurant_id', tenant.restaurantId)
        .update({ ...changes, updated_at: new Date() })
      if (Number(updated) === 0) throw ApiError.notFound()
    } catch (error) {
      if (isUniqueViolation(error, 'categories_restaurant_name_unique')) throw nameTaken()
      throw error
    }
    const fresh = await findCategory(ctx)
    if (!fresh) throw ApiError.notFound()
    return { data: fresh.toApi() }
  }

  async destroy(ctx: HttpContext) {
    const { tenant, params } = ctx
    try {
      const deleted = await db
        .from('categories')
        .where('id', uuidParam(params.id))
        .where('restaurant_id', tenant.restaurantId)
        .delete()
      if (Number(deleted) === 0) throw ApiError.notFound()
    } catch (error) {
      // A FK composta de products impede a exclusão, inclusive em corrida com um novo produto
      if (isForeignKeyViolation(error, 'products_category_restaurant_fk')) {
        throw new ApiError(
          409,
          'CATEGORY_HAS_PRODUCTS',
          'A categoria possui produtos. Mova ou exclua os produtos antes.'
        )
      }
      throw error
    }
    return ctx.response.noContent()
  }
}
