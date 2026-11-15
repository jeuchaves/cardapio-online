import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import Restaurant from '#models/restaurant'
import RestaurantUser from '#models/restaurant_user'
import User from '#models/user'
import { audit } from '#support/audit'
import {
  isUniqueViolation,
  rejectBlankWhenPresent,
  rejectUnknownFields,
  uuidParam,
  validationError,
} from '#support/request_helpers'
import { revokeUserSessions } from '#support/session_control'
import { generateTemporaryPassword } from '#support/temporary_password'
import {
  createRestaurantValidator,
  listRestaurantsValidator,
  updateRestaurantValidator,
  updateStatusValidator,
} from '#validators/restaurant'

const slugTaken = () => new ApiError(409, 'SLUG_TAKEN', 'Este slug já está em uso.')
const emailTaken = () =>
  new ApiError(
    409,
    'EMAIL_TAKEN',
    'Já existe um usuário com este e-mail. Confirme para vincular o usuário existente.'
  )

// Senha temporária aparece só nesta resposta: nunca em cache.
function noStore({ response }: HttpContext) {
  response.header('Cache-Control', 'no-store')
}

async function findRestaurant(id: unknown) {
  const restaurant = await Restaurant.find(uuidParam(id))
  if (!restaurant) throw ApiError.notFound()
  return restaurant
}

export default class PlatformRestaurantsController {
  async index({ request }: HttpContext) {
    const filters = await request.validateUsing(listRestaurantsValidator, { data: request.qs() })
    const page = filters.page ?? 1
    const perPage = filters.per_page ?? 20

    const query = Restaurant.query()
    if (filters.is_active !== undefined) query.where('is_active', filters.is_active)
    if (filters.search) {
      // Escapa os curingas do LIKE para a busca ser literal
      const term = `%${filters.search.replace(/[\\%_]/g, '\\$&')}%`
      query.where((group) => group.whereILike('name', term).orWhereILike('slug', term))
    }

    const result = await query.orderBy('name').paginate(page, perPage)
    return {
      data: result.all().map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        is_active: restaurant.isActive,
        created_at: restaurant.createdAt,
      })),
      meta: { page, per_page: perPage, total: result.total },
    }
  }

  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const body = request.body()
    rejectUnknownFields(body, [
      'name',
      'slug',
      'description',
      'phone',
      'owner',
      'confirm_link_existing_user',
    ])
    rejectUnknownFields(body.owner, ['name', 'email'])
    const input = await request.validateUsing(createRestaurantValidator)
    const ownerEmail = User.normalizeEmail(input.owner.email)

    try {
      const result = await db.transaction(async (trx) => {
        const existing = await User.query({ client: trx }).where('email', ownerEmail).first()
        if (existing && !input.confirm_link_existing_user) throw emailTaken()
        // D7: administrador da plataforma não é owner nem staff de restaurante
        if (existing?.isPlatformAdmin) {
          throw validationError(
            'owner.email',
            'Administrador da plataforma não pode ser vinculado.'
          )
        }

        const restaurant = await Restaurant.create(
          {
            name: input.name,
            slug: input.slug,
            description: input.description || null,
            phone: input.phone || null,
          },
          { client: trx }
        )

        let temporaryPassword: string | undefined
        let owner = existing
        if (!owner) {
          temporaryPassword = generateTemporaryPassword()
          owner = await User.create(
            {
              name: input.owner.name,
              email: ownerEmail,
              password: temporaryPassword,
              mustChangePassword: true,
            },
            { client: trx }
          )
        }

        await RestaurantUser.create(
          { restaurantId: restaurant.id, userId: owner.id, role: 'owner' },
          { client: trx }
        )
        return { restaurant, owner, temporaryPassword, linked: Boolean(existing) }
      })

      const actorId = auth.user!.id
      audit(actorId, 'restaurant.create', { type: 'restaurant', id: result.restaurant.id })
      audit(actorId, result.linked ? 'user.link_owner' : 'user.create_owner', {
        type: 'user',
        id: result.owner.id,
      })

      noStore(ctx)
      return response.status(201).send({
        data: {
          restaurant: result.restaurant.toApi(),
          owner: {
            id: result.owner.id,
            name: result.owner.name,
            email: result.owner.email,
            ...(result.temporaryPassword ? { temporary_password: result.temporaryPassword } : {}),
          },
        },
      })
    } catch (error) {
      // Corrida entre a verificação e o INSERT: a restrição do banco decide
      if (isUniqueViolation(error, 'restaurants_slug_unique')) throw slugTaken()
      if (isUniqueViolation(error, 'users_email_lower_unique')) throw emailTaken()
      throw error
    }
  }

  async show({ params }: HttpContext) {
    const restaurant = await findRestaurant(params.id)
    return { data: restaurant.toApi() }
  }

  async update({ params, request, auth }: HttpContext) {
    const restaurant = await findRestaurant(params.id)
    rejectUnknownFields(request.body(), [
      'name',
      'slug',
      'description',
      'phone',
      'confirm_slug_change',
    ])
    rejectBlankWhenPresent(request.body(), ['name', 'slug'])
    const { confirm_slug_change: confirmSlugChange, ...input } =
      await request.validateUsing(updateRestaurantValidator)

    if (input.slug !== undefined && input.slug !== restaurant.slug && !confirmSlugChange) {
      throw validationError(
        'confirm_slug_change',
        'Alterar o slug invalida links e QR Codes já impressos: confirme a alteração.'
      )
    }

    restaurant.merge({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.description === undefined ? {} : { description: input.description || null }),
      ...(input.phone === undefined ? {} : { phone: input.phone || null }),
    })
    try {
      await restaurant.save()
    } catch (error) {
      if (isUniqueViolation(error, 'restaurants_slug_unique')) throw slugTaken()
      throw error
    }

    audit(auth.user!.id, 'restaurant.update', { type: 'restaurant', id: restaurant.id })
    return { data: restaurant.toApi() }
  }

  async updateStatus({ params, request, auth }: HttpContext) {
    const restaurant = await findRestaurant(params.id)
    rejectUnknownFields(request.body(), ['is_active'])
    const { is_active: isActive } = await request.validateUsing(updateStatusValidator)

    restaurant.isActive = isActive
    await restaurant.save()
    audit(auth.user!.id, isActive ? 'restaurant.activate' : 'restaurant.deactivate', {
      type: 'restaurant',
      id: restaurant.id,
    })
    return { data: restaurant.toApi() }
  }

  async resetOwnerPassword(ctx: HttpContext) {
    const { params, request, auth } = ctx
    const restaurant = await findRestaurant(params.id)
    rejectUnknownFields(request.body(), [])

    // O backend identifica o owner do restaurante; a plataforma não recebe seus dados pessoais
    const owners = await RestaurantUser.query()
      .where('restaurant_id', restaurant.id)
      .where('role', 'owner')
      .limit(2)
    if (owners.length === 0) throw ApiError.notFound()
    if (owners.length > 1) {
      throw new ApiError(409, 'MULTIPLE_OWNERS', 'O restaurante tem mais de um dono.')
    }

    const user = await User.findOrFail(owners[0].userId)
    const temporaryPassword = generateTemporaryPassword()
    user.password = temporaryPassword
    user.mustChangePassword = true
    await user.save()
    // D11: a senha pertence ao usuário; todas as sessões dele caem
    await revokeUserSessions(user.id)

    audit(auth.user!.id, 'user.reset_password', { type: 'user', id: user.id })
    noStore(ctx)
    return {
      data: { temporary_password: temporaryPassword },
    }
  }
}
