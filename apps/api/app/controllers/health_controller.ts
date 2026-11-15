import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class HealthController {
  async show({ response, logger }: HttpContext) {
    try {
      await db.rawQuery('select 1')
    } catch (error) {
      // Registra só o código do erro: a resposta e o log não expõem host nem credenciais.
      logger.error(
        { code: (error as { code?: string }).code },
        'health check: database unavailable'
      )
      return response.status(503).send({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Serviço indisponível.',
      })
    }

    return { data: { status: 'ok' } }
  }
}
