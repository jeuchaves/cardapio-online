import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiError from '#exceptions/api_error'

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Origem normalizada de APP_URL (esquema e host em minúsculas, sem caminho, barra final
// nem porta padrão).
export function normalizeOrigin(appUrl: string) {
  return new URL(appUrl).origin
}

const trustedOrigin = normalizeOrigin(env.get('APP_URL'))

/**
 * CSRF por validação exata do header Origin (ADR 0002). Sem alternativa por Referer.
 */
export default class OriginMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    if (STATE_CHANGING.has(request.method()) && request.header('origin') !== trustedOrigin) {
      throw ApiError.forbidden()
    }
    return next()
  }
}
