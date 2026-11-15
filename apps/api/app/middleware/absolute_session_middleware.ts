import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiError from '#exceptions/api_error'
import { endCurrentSession } from '#support/session_control'

/**
 * Limite absoluto desde o login (ADR 0002). `login_at` nunca é atualizado por atividade.
 * Sessão sem `login_at` ou acima do limite é destruída e responde 401.
 */
export default class AbsoluteSessionMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const loginAt = ctx.session.get('login_at')
    const limitMs = env.get('SESSION_ABSOLUTE_HOURS', 12) * 60 * 60 * 1000

    if (typeof loginAt !== 'number' || Date.now() - loginAt > limitMs) {
      await endCurrentSession(ctx)
      throw ApiError.unauthenticated()
    }
    return next()
  }
}
