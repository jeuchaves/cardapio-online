import ApiError from '#exceptions/api_error'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Id de rota malformado nunca chega ao banco: responde 404 como recurso inexistente. */
export function uuidParam(value: unknown) {
  if (!isUuid(value)) throw ApiError.notFound()
  return value
}

/** O validator do Vine descarta campos extras; a API os rejeita (ROADMAP seção 6). */
export function rejectUnknownFields(body: unknown, allowed: string[]) {
  const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Dados inválidos.',
      unknown.map((field) => ({ field, message: 'Campo não permitido.' }))
    )
  }
}

export function validationError(field: string, message: string) {
  return new ApiError(422, 'VALIDATION_ERROR', 'Dados inválidos.', [{ field, message }])
}

/** Violação de unicidade do PostgreSQL (23505), opcionalmente de uma restrição específica. */
export function isUniqueViolation(error: unknown, constraint?: string) {
  const pg = error as { code?: string; constraint?: string }
  return pg?.code === '23505' && (constraint === undefined || pg.constraint === constraint)
}

/**
 * Campo obrigatório quando presente: o Vine trata '' e null de um campo opcional como ausente,
 * então um PATCH com { name: '' } passaria em silêncio. Aqui ele é rejeitado.
 */
export function rejectBlankWhenPresent(body: unknown, fields: string[]) {
  const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  for (const field of fields) {
    if (field in record && (record[field] === null || record[field] === '')) {
      throw validationError(field, 'Campo obrigatório.')
    }
  }
}

/** Violação de chave estrangeira do PostgreSQL (23503), opcionalmente de uma restrição específica. */
export function isForeignKeyViolation(error: unknown, constraint?: string) {
  const pg = error as { code?: string; constraint?: string }
  return pg?.code === '23503' && (constraint === undefined || pg.constraint === constraint)
}
