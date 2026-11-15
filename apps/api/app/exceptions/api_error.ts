/**
 * Erro de negócio com o formato de resposta do contrato: { code, message, details? }.
 */
export default class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
  }

  static unauthenticated() {
    return new ApiError(401, 'UNAUTHENTICATED', 'Autenticação necessária.')
  }

  static forbidden() {
    return new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para esta ação.')
  }

  static notFound() {
    return new ApiError(404, 'NOT_FOUND', 'Recurso não encontrado.')
  }
}
