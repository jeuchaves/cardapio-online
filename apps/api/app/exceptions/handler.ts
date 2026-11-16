import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import ApiError from '#exceptions/api_error'
import { safeMessage, sanitizeError } from '#support/log_error'

type KnownError = { code?: string; status?: number; messages?: unknown; response?: unknown }

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  /**
   * Todo erro sai no formato { code, message, details? }, sem detalhes internos.
   */
  async handle(error: unknown, ctx: HttpContext) {
    const { response } = ctx
    const known = (error ?? {}) as KnownError

    if (error instanceof ApiError) {
      return response.status(error.status).send({
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      })
    }

    switch (known.code) {
      case 'E_VALIDATION_ERROR':
        return response.status(422).send({
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: known.messages,
        })
      case 'E_UNAUTHORIZED_ACCESS':
        return response.status(401).send(toBody(ApiError.unauthenticated()))
      case 'E_ROUTE_NOT_FOUND':
      case 'E_ROW_NOT_FOUND':
        return response.status(404).send(toBody(ApiError.notFound()))
      case 'E_REQUEST_ENTITY_TOO_LARGE':
        return response.status(413).send({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'O arquivo enviado é grande demais.',
        })
      case 'E_TOO_MANY_REQUESTS': {
        const availableIn = (known.response as { availableIn?: number } | undefined)?.availableIn
        if (availableIn) response.header('Retry-After', String(availableIn))
        return response.status(429).send({
          code: 'RATE_LIMITED',
          message: 'Muitas tentativas. Aguarde um momento e tente novamente.',
        })
      }
    }

    if (typeof known.status === 'number' && known.status >= 400 && known.status < 500) {
      return response
        .status(known.status)
        .send({ code: 'BAD_REQUEST', message: 'Requisição inválida.' })
    }

    return response
      .status(500)
      .send({ code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' })
  }

  /**
   * Mesma regra do Adonis (shouldReport, nível e x-request-id), mas o erro vai ao log só pela
   * lista de propriedades permitidas de `sanitizeError`, nunca o objeto original.
   */
  async report(error: unknown, ctx: HttpContext) {
    const httpError = this.toHttpError(error)
    if (!this.shouldReport(httpError)) return
    if (typeof httpError.report === 'function') {
      httpError.report(httpError, ctx)
      return
    }

    const level = this.getErrorLogLevel(httpError)
    const route = ctx.route?.pattern
    ctx.logger.log(
      level,
      {
        ...(level === 'error' || level === 'fatal' ? { err: sanitizeError(httpError) } : {}),
        ...this.context(ctx),
        ...(route ? { route } : {}),
      },
      safeMessage(httpError)
    )
  }
}

function toBody(error: ApiError) {
  return { code: error.code, message: error.message }
}
