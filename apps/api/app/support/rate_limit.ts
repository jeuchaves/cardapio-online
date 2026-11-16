import { createHash } from 'node:crypto'
import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'

// ADR 0004: contadores em memória. Cada regra tem prefixo próprio e contador independente.
async function consume(key: string, requests: number) {
  await limiter.use('memory', { requests, duration: '1 min' }).consume(key)
}

// A chave nunca contém senha; o e-mail entra normalizado e em hash.
function emailKey(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

/** Lança E_TOO_MANY_REQUESTS (429) ao exceder qualquer um dos dois limites de login. */
export async function throttleLogin(ip: string, email: string) {
  await consume(`login:ip:${ip}`, Number(env.get('LIMITER_LOGIN_IP_PER_MINUTE', 20)))
  await consume(
    `login:ip-email:${ip}:${emailKey(email)}`,
    Number(env.get('LIMITER_LOGIN_IP_EMAIL_PER_MINUTE', 5))
  )
}

/** Criação de pedido: 5 por minuto por IP e restaurante (ROADMAP seção 6). */
export async function throttleOrderCreation(ip: string, restaurantId: string) {
  await consume(
    `order:ip-restaurant:${ip}:${restaurantId}`,
    Number(env.get('LIMITER_ORDER_PER_MINUTE', 5))
  )
}

/** Cotação do carrinho: 30 por minuto por IP e restaurante (ROADMAP seção 6). */
export async function throttleQuote(ip: string, restaurantId: string) {
  await consume(
    `quote:ip-restaurant:${ip}:${restaurantId}`,
    Number(env.get('LIMITER_QUOTE_PER_MINUTE', 30))
  )
}

/** Acompanhamento de pedido: 30 consultas por minuto por IP (ROADMAP seção 6). */
export async function throttleTracking(ip: string) {
  await consume(`tracking:ip:${ip}`, Number(env.get('LIMITER_TRACKING_PER_MINUTE', 30)))
}

export async function throttlePasswordChange(userId: string) {
  await consume(`password:${userId}`, Number(env.get('LIMITER_PASSWORD_PER_MINUTE', 5)))
}
