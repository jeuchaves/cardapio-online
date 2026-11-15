import vine from '@vinejs/vine'

// D4: slugs reservados não podem identificar restaurantes (colidem com rotas do frontend).
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'entrar',
  'login',
  'logout',
  'painel',
  'plataforma',
  'platform',
  'public',
  'r',
  'static',
  'tenant',
  'www',
  '_next',
]

// Normalizado para minúsculas; o banco também exige o formato e a unicidade.
const slug = () =>
  vine
    .string()
    .trim()
    .toLowerCase()
    .minLength(3)
    .maxLength(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .notIn(RESERVED_SLUGS)

const name = () => vine.string().trim().minLength(1).maxLength(120)
const description = () => vine.string().trim().maxLength(1000).nullable().optional()
const phone = () =>
  vine
    .string()
    .trim()
    .maxLength(20)
    .regex(/^[0-9+()\s-]+$/)
    .nullable()
    .optional()
const email = () => vine.string().trim().email().maxLength(254)

export const listRestaurantsValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).optional(),
  per_page: vine.number().withoutDecimals().min(1).max(100).optional(),
  search: vine.string().trim().maxLength(120).optional(),
  is_active: vine.boolean().optional(),
})

export const createRestaurantValidator = vine.create({
  name: name(),
  slug: slug(),
  description: description(),
  phone: phone(),
  owner: vine.object({ name: name(), email: email() }),
  confirm_link_existing_user: vine.boolean().optional(),
})

export const updateRestaurantValidator = vine.create({
  name: name().optional(),
  slug: slug().optional(),
  description: description(),
  phone: phone(),
  confirm_slug_change: vine.boolean().optional(),
})

export const updateStatusValidator = vine.create({ is_active: vine.boolean() })

export const updateTenantRestaurantValidator = vine.create({
  name: name().optional(),
  description: description(),
  phone: phone(),
})

export const updateSettingsValidator = vine.create({
  accepts_dine_in: vine.boolean().optional(),
  accepts_pickup: vine.boolean().optional(),
  accepts_cash: vine.boolean().optional(),
  accepts_card: vine.boolean().optional(),
  accepts_pix: vine.boolean().optional(),
})

export const createStaffValidator = vine.create({ name: name(), email: email() })

export const updateStaffValidator = vine.create({ is_active: vine.boolean() })
