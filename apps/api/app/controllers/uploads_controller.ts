import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import ApiError from '#exceptions/api_error'
import { IMAGE_KEY, contentTypeOf } from '#support/images'

export default class UploadsController {
  /** Só leitura, só chaves no formato exato de imagem: sem listagem nem caminho arbitrário. */
  async show({ params, response }: HttpContext) {
    const key = (params['*'] as string[]).join('/')
    if (!IMAGE_KEY.test(key)) throw ApiError.notFound()
    const disk = drive.use()
    if (!(await disk.exists(key))) throw ApiError.notFound()

    response.header('Content-Type', contentTypeOf(key))
    response.header('X-Content-Type-Options', 'nosniff')
    // Defesa em profundidade: se um arquivo for aberto direto, nada nele executa nem carrega recurso
    response.header('Content-Security-Policy', "default-src 'none'; sandbox")
    // A chave é única por arquivo (UUID): o conteúdo nunca muda sob a mesma URL
    response.header('Cache-Control', 'public, max-age=31536000, immutable')
    return response.stream(await disk.getStream(key))
  }
}
