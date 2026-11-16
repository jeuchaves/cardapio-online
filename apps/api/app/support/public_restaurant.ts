import db from '@adonisjs/lucid/services/db'
import ApiError from '#exceptions/api_error'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export type PublicRestaurant = {
  id: string
  name: string
  slug: string
  description: string | null
  phone: string | null
  logo: string | null
  accepts_dine_in: boolean
  accepts_pickup: boolean
  accepts_cash: boolean
  accepts_card: boolean
  accepts_pix: boolean
}

/**
 * Resolve o tenant de uma rota pública pelo slug. Slug malformado, inexistente ou de restaurante
 * inativo respondem o mesmo 404, sem diferenciar.
 */
export async function findActiveRestaurantBySlug(slug: string): Promise<PublicRestaurant> {
  if (slug.length > 60 || !SLUG.test(slug)) throw ApiError.notFound()
  const restaurant = await db
    .from('restaurants')
    .where('slug', slug)
    .where('is_active', true)
    .first()
  if (!restaurant) throw ApiError.notFound()
  return restaurant
}
