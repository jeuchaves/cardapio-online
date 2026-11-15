import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import { imageUrl } from '#support/images'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Rota pública (ADR 0002): sem sessão. O tenant vem do slug; slug inválido, inexistente ou de
// restaurante inativo respondem o mesmo 404. Só dados públicos: nada de ids de restaurante,
// is_active, sort_order, timestamps ou itens indisponíveis.
export default class PublicMenuController {
  async show({ params }: HttpContext) {
    const slug = String(params.slug)
    if (slug.length > 60 || !SLUG.test(slug)) throw ApiError.notFound()

    const restaurant = await db
      .from('restaurants')
      .where('slug', slug)
      .where('is_active', true)
      .first()
    if (!restaurant) throw ApiError.notFound()

    const categories = await db
      .from('categories')
      .where('restaurant_id', restaurant.id)
      .where('is_active', true)
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'name', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
      .select('id', 'name', 'description')

    const products = await db
      .from('products')
      .where('restaurant_id', restaurant.id)
      .where('is_available', true)
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'name', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
      .select('id', 'category_id', 'name', 'description', 'price', 'image')

    const links = await db
      .from('product_product_addons as link')
      .join('product_addons as addon', 'addon.id', 'link.product_addon_id')
      .where('link.restaurant_id', restaurant.id)
      .where('addon.restaurant_id', restaurant.id)
      .where('addon.is_available', true)
      .orderBy([
        { column: 'addon.name', order: 'asc' },
        { column: 'addon.id', order: 'asc' },
      ])
      .select('link.product_id', 'addon.id', 'addon.name', 'addon.description', 'addon.price')

    const addonsByProduct = new Map<string, object[]>()
    for (const row of links) {
      const list = addonsByProduct.get(row.product_id) ?? []
      list.push({ id: row.id, name: row.name, description: row.description, price: row.price })
      addonsByProduct.set(row.product_id, list)
    }

    const productsByCategory = new Map<string, object[]>()
    for (const product of products) {
      const list = productsByCategory.get(product.category_id) ?? []
      list.push({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: imageUrl(product.image),
        addons: addonsByProduct.get(product.id) ?? [],
      })
      productsByCategory.set(product.category_id, list)
    }

    return {
      data: {
        restaurant: {
          name: restaurant.name,
          slug: restaurant.slug,
          description: restaurant.description,
          phone: restaurant.phone,
          logo_url: imageUrl(restaurant.logo),
          // Só o que está habilitado: opção desabilitada não aparece
          fulfillment_modes: [
            ...(restaurant.accepts_dine_in ? ['dine_in'] : []),
            ...(restaurant.accepts_pickup ? ['pickup'] : []),
          ],
          payment_methods: [
            ...(restaurant.accepts_cash ? ['cash'] : []),
            ...(restaurant.accepts_card ? ['card'] : []),
            ...(restaurant.accepts_pix ? ['pix'] : []),
          ],
        },
        // Categoria sem produto disponível não aparece: o cliente não tem o que escolher nela
        categories: categories
          .map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description,
            products: productsByCategory.get(category.id) ?? [],
          }))
          .filter((category) => category.products.length > 0),
      },
    }
  }
}
