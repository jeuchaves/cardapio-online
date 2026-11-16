import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import type { ApiResponse } from '@japa/api-client'
import Restaurant from '#models/restaurant'
import RestaurantUser from '#models/restaurant_user'
import User from '#models/user'

export const ORIGIN = 'http://localhost:3000'
export const PASSWORD = 'senha-de-teste-123'
export const SESSION_COOKIE = 'cardapio_session'

let counter = 0
function next() {
  counter += 1
  return counter
}

/** Estado limpo entre testes: tabelas e contadores de rate limit. */
export async function resetState() {
  await db.rawQuery(
    'TRUNCATE sessions, restaurant_users, order_status_history, order_item_addons, order_items, orders, product_product_addons, restaurant_tables, products, product_addons, categories, restaurants, users'
  )
  await limiter.clear()
}

export async function createUser(
  overrides: Partial<{
    name: string
    email: string
    password: string
    isPlatformAdmin: boolean
    mustChangePassword: boolean
  }> = {}
) {
  const n = next()
  return User.create({
    name: `Usuário ${n}`,
    email: `usuario${n}@exemplo.com`,
    password: PASSWORD,
    isPlatformAdmin: false,
    mustChangePassword: false,
    ...overrides,
  })
}

export async function createRestaurant(overrides: Partial<{ name: string; slug: string }> = {}) {
  const n = next()
  return Restaurant.create({ name: `Restaurante ${n}`, slug: `restaurante-${n}`, ...overrides })
}

export async function link(
  user: User,
  restaurant: Restaurant,
  role: 'owner' | 'staff',
  isActive = true
) {
  return RestaurantUser.create({
    userId: user.id,
    restaurantId: restaurant.id,
    role,
    isActive,
  })
}

/** Cria um restaurante com owner e um staff, ambos com vínculo ativo. */
export async function createRestaurantWithTeam() {
  const restaurant = await createRestaurant()
  const owner = await createUser()
  const staff = await createUser()
  await link(owner, restaurant, 'owner')
  await link(staff, restaurant, 'staff')
  return { restaurant, owner, staff }
}

export function loginRequest(client: ApiClient, email: string, password = PASSWORD) {
  return client.post('/api/v1/auth/login').header('Origin', ORIGIN).json({ email, password })
}

/** Valor "nome=valor" do cookie de sessão definido pela resposta, pronto para o header Cookie. */
export function sessionCookie(response: ApiResponse): string {
  const raw = response.headers()['set-cookie'] as string[] | string | undefined
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const entry = list.find((item) => item.startsWith(`${SESSION_COOKIE}=`))
  if (!entry) throw new Error('Resposta sem cookie de sessão')
  return entry.split(';')[0]
}

export async function loginAndGetCookie(client: ApiClient, email: string, password = PASSWORD) {
  const response = await loginRequest(client, email, password)
  response.assertStatus(200)
  return sessionCookie(response)
}

/** Requisição autenticada: cookie e Origin válidos. */
export function authed(
  client: ApiClient,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  url: string,
  cookie: string
) {
  return client[method](url).header('Cookie', cookie).header('Origin', ORIGIN)
}

/** Avança o relógio visto pelo código da aplicação (Date.now). Devolve a função que restaura. */
export function advanceClock(ms: number) {
  const real = Date.now
  Date.now = () => real() + ms
  return () => {
    Date.now = real
  }
}
