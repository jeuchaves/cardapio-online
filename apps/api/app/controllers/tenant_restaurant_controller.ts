import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import Restaurant from '#models/restaurant'
import { audit } from '#support/audit'
import { removeImage, storeImage, validateImage } from '#support/images'
import {
  rejectBlankWhenPresent,
  rejectUnknownFields,
  validationError,
} from '#support/request_helpers'
import { updateSettingsValidator, updateTenantRestaurantValidator } from '#validators/restaurant'

// Sempre pelo restaurante do vínculo validado (ctx.tenant), nunca por um id vindo do cliente.
async function currentRestaurant({ tenant }: HttpContext) {
  const restaurant = await Restaurant.query().where('id', tenant.restaurantId).first()
  if (!restaurant) throw ApiError.notFound()
  return restaurant
}

export default class TenantRestaurantController {
  async show(ctx: HttpContext) {
    const restaurant = await currentRestaurant(ctx)
    return { data: restaurant.toApi() }
  }

  async update(ctx: HttpContext) {
    const restaurant = await currentRestaurant(ctx)
    // slug e is_active só pela plataforma: campos fora da lista são rejeitados
    rejectUnknownFields(ctx.request.body(), ['name', 'description', 'phone'])
    rejectBlankWhenPresent(ctx.request.body(), ['name'])
    const input = await ctx.request.validateUsing(updateTenantRestaurantValidator)

    restaurant.merge({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description || null }),
      ...(input.phone === undefined ? {} : { phone: input.phone || null }),
    })
    await restaurant.save()

    audit(ctx.auth.user!.id, 'restaurant.update', { type: 'restaurant', id: restaurant.id })
    return { data: restaurant.toApi() }
  }

  async updateSettings(ctx: HttpContext) {
    const restaurant = await currentRestaurant(ctx)
    rejectUnknownFields(ctx.request.body(), [
      'accepts_dine_in',
      'accepts_pickup',
      'accepts_cash',
      'accepts_card',
      'accepts_pix',
    ])
    const input = await ctx.request.validateUsing(updateSettingsValidator)

    const next = {
      acceptsDineIn: input.accepts_dine_in ?? restaurant.acceptsDineIn,
      acceptsPickup: input.accepts_pickup ?? restaurant.acceptsPickup,
      acceptsCash: input.accepts_cash ?? restaurant.acceptsCash,
      acceptsCard: input.accepts_card ?? restaurant.acceptsCard,
      acceptsPix: input.accepts_pix ?? restaurant.acceptsPix,
    }
    if (!next.acceptsDineIn && !next.acceptsPickup) {
      throw validationError('accepts_dine_in', 'Habilite ao menos uma modalidade de atendimento.')
    }
    if (!next.acceptsCash && !next.acceptsCard && !next.acceptsPix) {
      throw validationError('accepts_cash', 'Habilite ao menos um método de pagamento.')
    }

    restaurant.merge(next)
    await restaurant.save()

    audit(ctx.auth.user!.id, 'restaurant.update_settings', {
      type: 'restaurant',
      id: restaurant.id,
    })
    return { data: restaurant.toApi() }
  }

  /** Mesma ordem do produto: validar, gravar o novo, atualizar o banco e só então apagar o antigo. */
  async putLogo(ctx: HttpContext) {
    const upload = await validateImage(ctx.request)
    const newKey = await storeImage(ctx.tenant.restaurantId, 'logo', upload)

    let oldKey: string | null
    let restaurant: Restaurant
    try {
      ;({ oldKey, restaurant } = await db.transaction(async (trx) => {
        const locked = await Restaurant.query({ client: trx })
          .where('id', ctx.tenant.restaurantId)
          .forUpdate()
          .first()
        if (!locked) throw ApiError.notFound()
        const previous = locked.logo
        locked.logo = newKey
        await locked.save()
        return { oldKey: previous, restaurant: locked }
      }))
    } catch (error) {
      await removeImage(newKey)
      throw error
    }
    await removeImage(oldKey)

    audit(ctx.auth.user!.id, 'restaurant.update_logo', { type: 'restaurant', id: restaurant.id })
    return { data: restaurant.toApi() }
  }
}
