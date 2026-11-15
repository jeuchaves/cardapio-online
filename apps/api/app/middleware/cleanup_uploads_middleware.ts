import { unlink } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * O bodyparser grava o multipart em arquivo temporário e não o apaga. Este middleware
 * (o primeiro do grupo) remove os temporários ao fim de qualquer resposta, inclusive as
 * recusadas por autenticação, perfil ou validação.
 */
export default class CleanupUploadsMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    try {
      return await next()
    } finally {
      for (const entry of Object.values(request.allFiles())) {
        for (const file of Array.isArray(entry) ? entry : [entry]) {
          if (file.tmpPath) await unlink(file.tmpPath).catch(() => {})
        }
      }
    }
  }
}
