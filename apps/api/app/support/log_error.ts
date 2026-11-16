// Erros chegam ao log só por esta função (ROADMAP 7.3 e seção 6). O objeto original nunca é
// serializado: o `pg` anexa `detail`/`where` com os valores da linha, e o knex grava na `message`
// o SQL já com os valores dos parâmetros. Só saem as propriedades abaixo, com texto saneado.

export type LoggedError = {
  name: string
  code?: string
  status?: number
  constraint?: string
  table?: string
  message: string
  stack?: string
}

type ErrorLike = {
  name?: unknown
  code?: unknown
  status?: unknown
  constraint?: unknown
  table?: unknown
  message?: unknown
  stack?: unknown
  severity?: unknown
  routine?: unknown
}

const MAX_MESSAGE = 200
const MAX_FRAMES = 15

const text = (value: unknown) => (typeof value === 'string' ? value : undefined)

// Erro de banco: a mensagem pode trazer valores (SQL formatado, "invalid input syntax … "valor"").
// Nunca é copiada; basta o código SQLSTATE, a constraint e a tabela.
function isDatabaseError(error: ErrorLike) {
  return typeof error.routine === 'string' || typeof error.severity === 'string'
}

// Rede de segurança para mensagens de outras origens: tira o que parece valor (aspas, e-mail,
// UUID, token de 43 caracteres, sequências longas de dígitos) e limita o tamanho.
export function scrubMessage(message: string) {
  return message
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '[redacted]')
    .replace(/[^\s@]+@[^\s@]+/g, '[redacted]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .replace(/\d{6,}/g, '[redacted]')
    .split('\n')[0]
    .slice(0, MAX_MESSAGE)
}

// A primeira linha da stack repete a mensagem; ficam só os quadros (arquivo e função).
function frames(stack: string | undefined) {
  if (!stack) return undefined
  return stack
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .slice(0, MAX_FRAMES)
    .join('\n')
}

export function safeMessage(error: unknown) {
  const source = (error ?? {}) as ErrorLike
  if (isDatabaseError(source)) return `database error ${text(source.code) ?? ''}`.trim()
  return scrubMessage(text(source.message) ?? 'erro desconhecido')
}

export function sanitizeError(error: unknown): LoggedError {
  const source = (error ?? {}) as ErrorLike
  const logged: LoggedError = {
    name: text(source.name) ?? 'Error',
    message: safeMessage(error),
  }
  const code = text(source.code)
  if (code) logged.code = code
  if (typeof source.status === 'number') logged.status = source.status
  const constraint = text(source.constraint)
  if (constraint) logged.constraint = constraint
  const table = text(source.table)
  if (table) logged.table = table
  const stack = frames(text(source.stack))
  if (stack) logged.stack = stack
  return logged
}
