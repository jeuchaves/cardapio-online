import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import Category from '#models/category'
import Product, { type ProductAddonSummary } from '#models/product'
import { removeImage, storeImage, validateImage } from '#support/images'
import { parsePrice } from '#support/money'
import {
  isForeignKeyViolation,
  rejectBlankWhenPresent,
  rejectUnknownFields,
  uuidParam,
  validationError,
} from '#support/request_helpers'
import {
  createProductValidator,
  listProductsValidator,
  replaceProductAddonsValidator,
  updateProductValidator,
} from '#validators/product'

const FIELDS = ['category_id', 'name', 'description', 'price', 'sort_order', 'is_available']
const CATEGORY_FK = 'products_category_restaurant_fk'

const invalidCategory = () => validationError('category_id', 'Categoria inválida.')

/** Categoria de outro restaurante é indistinguível de categoria inexistente. */
async function assertCategory(restaurantId: string, categoryId: string) {
  const category = await Category.query()
    .where('id', categoryId)
    .where('restaurant_id', restaurantId)
    .first()
  if (!category) throw invalidCategory()
}

/** is_available é campo do owner (D8): staff que o envia recebe 403, mesmo com valor igual. */
function assertCanSetAvailability({ tenant, request }: HttpContext) {
  if (tenant.role !== 'owner' && 'is_available' in request.body()) throw ApiError.forbidden()
}

async function addonsByProduct(restaurantId: string, productIds: string[]) {
  const map = new Map<string, ProductAddonSummary[]>()
  if (productIds.length === 0) return map
  const rows = await db
    .from('product_product_addons as link')
    .join('product_addons as addon', 'addon.id', 'link.product_addon_id')
    .where('link.restaurant_id', restaurantId)
    .where('addon.restaurant_id', restaurantId)
    .whereIn('link.product_id', productIds)
    .orderBy([
      { column: 'addon.name', order: 'asc' },
      { column: 'addon.id', order: 'asc' },
    ])
    .select(
      'link.product_id',
      'addon.id',
      'addon.name',
      'addon.description',
      'addon.price',
      'addon.is_available'
    )
  for (const row of rows) {
    const list = map.get(row.product_id) ?? []
    list.push({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      is_available: row.is_available,
    })
    map.set(row.product_id, list)
  }
  return map
}

async function present(restaurantId: string, product: Product) {
  const addons = await addonsByProduct(restaurantId, [product.id])
  return product.toApi(addons.get(product.id) ?? [])
}

function findProduct({ tenant, params }: HttpContext) {
  return Product.query()
    .where('id', uuidParam(params.id))
    .where('restaurant_id', tenant.restaurantId)
    .first()
}

export default class ProductsController {
  async index({ request, tenant }: HttpContext) {
    rejectUnknownFields(request.qs(), ['category_id', 'page', 'per_page'])
    const {
      category_id: categoryId,
      page = 1,
      per_page: perPage = 20,
    } = await request.validateUsing(listProductsValidator)

    const filtered = () => {
      const query = Product.query().where('restaurant_id', tenant.restaurantId)
      if (categoryId) query.where('category_id', categoryId)
      return query
    }

    const countQuery = db.from('products').where('restaurant_id', tenant.restaurantId)
    if (categoryId) countQuery.where('category_id', categoryId)
    const [{ total }] = await countQuery.count('* as total')
    const products = await filtered()
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'name', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
      .offset((page - 1) * perPage)
      .limit(perPage)

    const addons = await addonsByProduct(
      tenant.restaurantId,
      products.map((product) => product.id)
    )
    return {
      data: products.map((product) => product.toApi(addons.get(product.id) ?? [])),
      meta: { page, per_page: perPage, total: Number(total) },
    }
  }

  async store(ctx: HttpContext) {
    const { request, response, tenant } = ctx
    rejectUnknownFields(request.body(), FIELDS)
    assertCanSetAvailability(ctx)
    rejectBlankWhenPresent(request.body(), ['sort_order', 'is_available'])
    const input = await request.validateUsing(createProductValidator)
    const price = parsePrice(input.price)
    await assertCategory(tenant.restaurantId, input.category_id)

    try {
      const product = await Product.create({
        restaurantId: tenant.restaurantId,
        categoryId: input.category_id,
        name: input.name,
        description: input.description ?? null,
        price,
        sortOrder: input.sort_order ?? 0,
        isAvailable: input.is_available ?? true,
      })
      return response.status(201).send({ data: await present(tenant.restaurantId, product) })
    } catch (error) {
      // Categoria excluída entre a checagem e a gravação
      if (isForeignKeyViolation(error, CATEGORY_FK)) throw invalidCategory()
      throw error
    }
  }

  async update(ctx: HttpContext) {
    const { request, tenant } = ctx
    rejectUnknownFields(request.body(), FIELDS)
    assertCanSetAvailability(ctx)
    rejectBlankWhenPresent(request.body(), [
      'category_id',
      'name',
      'price',
      'sort_order',
      'is_available',
    ])
    const product = await findProduct(ctx)
    if (!product) throw ApiError.notFound()
    const input = await request.validateUsing(updateProductValidator)
    if (Object.keys(input).length === 0) throw validationError('body', 'Informe ao menos um campo.')

    const price = input.price !== undefined ? parsePrice(input.price) : undefined
    if (input.category_id !== undefined) {
      await assertCategory(tenant.restaurantId, input.category_id)
    }

    const changes = {
      ...(input.category_id !== undefined && { category_id: input.category_id }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(price !== undefined && { price }),
      ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
      ...(input.is_available !== undefined && { is_available: input.is_available }),
    }
    // O UPDATE tambem filtra por restaurant_id: o filtro do tenant nao depende so da leitura anterior
    try {
      const updated = await db
        .from('products')
        .where('id', product.id)
        .where('restaurant_id', tenant.restaurantId)
        .update({ ...changes, updated_at: new Date() })
      if (Number(updated) === 0) throw ApiError.notFound()
    } catch (error) {
      if (isForeignKeyViolation(error, CATEGORY_FK)) throw invalidCategory()
      throw error
    }
    const fresh = await findProduct(ctx)
    if (!fresh) throw ApiError.notFound()
    return { data: await present(tenant.restaurantId, fresh) }
  }

  async destroy(ctx: HttpContext) {
    // As associações com adicionais saem por ON DELETE CASCADE
    const deleted = await db
      .from('products')
      .where('id', uuidParam(ctx.params.id))
      .where('restaurant_id', ctx.tenant.restaurantId)
      .delete()
      .returning('image')
    if (deleted.length === 0) throw ApiError.notFound()
    await removeImage(deleted[0].image)
    return ctx.response.noContent()
  }

  /**
   * Substitui o conjunto de adicionais do produto. O produto é travado (FOR UPDATE) e os
   * adicionais, compartilhados (FOR SHARE, não podem ser excluídos no meio). Tudo é validado
   * antes de apagar as associações atuais; qualquer falha desfaz a transação inteira.
   */
  async replaceAddons(ctx: HttpContext) {
    const { request, tenant } = ctx
    rejectUnknownFields(request.body(), ['addon_ids'])
    const productId = uuidParam(ctx.params.id)
    const { addon_ids: rawIds } = await request.validateUsing(replaceProductAddonsValidator)
    const addonIds = [...new Set(rawIds.map((id) => id.toLowerCase()))]
    if (addonIds.length !== rawIds.length) {
      throw validationError('addon_ids', 'Não repita adicionais.')
    }

    try {
      await db.transaction(async (trx) => {
        const locked = await trx
          .from('products')
          .where('id', productId)
          .where('restaurant_id', tenant.restaurantId)
          .forUpdate()
          .first()
        if (!locked) throw ApiError.notFound()

        if (addonIds.length > 0) {
          // Inexistente e de outro restaurante são indistinguíveis
          const found = await trx
            .from('product_addons')
            .whereIn('id', addonIds)
            .where('restaurant_id', tenant.restaurantId)
            .forShare()
            .select('id')
          if (found.length !== addonIds.length)
            throw validationError('addon_ids', 'Adicional inválido.')
        }

        await trx
          .from('product_product_addons')
          .where('product_id', productId)
          .where('restaurant_id', tenant.restaurantId)
          .delete()
        if (addonIds.length > 0) {
          await trx.table('product_product_addons').insert(
            addonIds.map((addonId) => ({
              product_id: productId,
              product_addon_id: addonId,
              restaurant_id: tenant.restaurantId,
            }))
          )
        }
      })
    } catch (error) {
      if (isForeignKeyViolation(error)) throw validationError('addon_ids', 'Adicional inválido.')
      throw error
    }

    const product = await findProduct(ctx)
    if (!product) throw ApiError.notFound()
    return { data: await present(tenant.restaurantId, product) }
  }

  /**
   * Ordem: validar os bytes, gravar o arquivo novo, atualizar o banco e só então apagar o antigo.
   * Se o banco falhar, o arquivo novo é removido. A linha é travada para que substituições
   * simultâneas não deixem arquivo órfão.
   */
  async putImage(ctx: HttpContext) {
    const { request, tenant } = ctx
    const product = await findProduct(ctx)
    if (!product) throw ApiError.notFound()
    const upload = await validateImage(request)
    const newKey = await storeImage(tenant.restaurantId, 'products', upload)

    let oldKey: string | null
    try {
      oldKey = await swapImage(product.id, tenant.restaurantId, newKey)
    } catch (error) {
      await removeImage(newKey)
      throw error
    }
    await removeImage(oldKey)

    const updated = await findProduct(ctx)
    if (!updated) throw ApiError.notFound()
    return { data: await present(tenant.restaurantId, updated) }
  }

  async destroyImage(ctx: HttpContext) {
    const { tenant } = ctx
    const product = await findProduct(ctx)
    if (!product) throw ApiError.notFound()
    const oldKey = await swapImage(product.id, tenant.restaurantId, null)
    await removeImage(oldKey)
    return ctx.response.noContent()
  }
}

/** Troca a chave da imagem e devolve a anterior, na mesma transação, com o produto travado. */
async function swapImage(productId: string, restaurantId: string, key: string | null) {
  return db.transaction(async (trx) => {
    const row = await trx
      .from('products')
      .where('id', productId)
      .where('restaurant_id', restaurantId)
      .forUpdate()
      .first()
    if (!row) throw ApiError.notFound()
    await trx
      .from('products')
      .where('id', productId)
      .where('restaurant_id', restaurantId)
      .update({ image: key, updated_at: new Date() })
    return row.image as string | null
  })
}
