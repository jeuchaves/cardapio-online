import logger from '@adonisjs/core/services/logger'

/**
 * Log estruturado de ação administrativa (ROADMAP seção 6). Só ator, ação e recurso:
 * nunca senha, telefone, corpo da requisição ou dado pessoal.
 */
export function audit(actorId: string, action: string, resource: { type: string; id: string }) {
  logger.info(
    {
      audit: true,
      actor_id: actorId,
      action,
      resource_type: resource.type,
      resource_id: resource.id,
    },
    'audit'
  )
}
