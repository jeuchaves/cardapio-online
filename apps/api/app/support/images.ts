import { randomUUID } from 'node:crypto'
import { open, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import ApiError from '#exceptions/api_error'
import { rejectUnknownFields } from '#support/request_helpers'

// ADR 0003: só JPEG, PNG e WebP, até 5 MB, tipo detectado pelos bytes do arquivo
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const TYPES = {
  jpg: { mime: 'image/jpeg', mimes: ['image/jpeg', 'image/jpg'], extensions: ['jpg', 'jpeg'] },
  png: { mime: 'image/png', mimes: ['image/png'], extensions: ['png'] },
  webp: { mime: 'image/webp', mimes: ['image/webp'], extensions: ['webp'] },
} as const

type ImageExtension = keyof typeof TYPES

// Chave pública estrita: restaurants/<uuid>/(products|logo)/<uuid>.(jpg|png|webp)
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const IMAGE_KEY = new RegExp(`^restaurants/${UUID}/(products|logo)/${UUID}\.(jpg|png|webp)$`)

type Request = HttpContext['request']
type MultipartFile = ReturnType<Request['allFiles']>[string]

export type ImageUpload = { tmpPath: string; extension: ImageExtension }

const invalidImage = (message: string) => new ApiError(422, 'INVALID_IMAGE', message)

function detectExtension(head: Buffer): ImageExtension | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg'
  if (
    head.length >= 8 &&
    head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png'
  }
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

async function readHead(path: string) {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(12)
    const { bytesRead } = await handle.read(buffer, 0, 12, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

/**
 * Valida o arquivo enviado no campo `file`: um único arquivo, tamanho efetivo, assinatura
 * pelos bytes, extensão e MIME coerentes com o tipo detectado. Nunca confia no nome do cliente.
 * O arquivo temporário é do bodyparser e é removido por ele ao fim da requisição.
 */
export async function validateImage(request: Request): Promise<ImageUpload> {
  // O corpo também lista o campo do arquivo; qualquer outro campo é recusado
  rejectUnknownFields(request.body(), ['file'])
  const files = request.allFiles()
  const names = Object.keys(files)
  const file = files.file as MultipartFile | MultipartFile[] | undefined
  if (names.length !== 1 || !file || Array.isArray(file)) {
    throw invalidImage('Envie uma única imagem no campo "file".')
  }
  if (!file.tmpPath) throw invalidImage('Arquivo inválido.')

  const { size } = await stat(file.tmpPath)
  if (size === 0) throw invalidImage('Arquivo vazio.')
  if (size > MAX_IMAGE_BYTES) throw invalidImage('A imagem excede 5 MB.')

  const extension = detectExtension(await readHead(file.tmpPath))
  if (!extension) throw invalidImage('Envie uma imagem JPEG, PNG ou WebP.')

  const type = TYPES[extension]
  const clientExtension = extname(file.clientName ?? '')
    .slice(1)
    .toLowerCase()
  const clientMime = String(file.headers?.['content-type'] ?? '').toLowerCase()
  if (!(type.extensions as readonly string[]).includes(clientExtension)) {
    throw invalidImage('A extensão do arquivo não corresponde ao conteúdo.')
  }
  if (!(type.mimes as readonly string[]).includes(clientMime)) {
    throw invalidImage('O tipo informado do arquivo não corresponde ao conteúdo.')
  }
  return { tmpPath: file.tmpPath, extension }
}

/** Grava a imagem sob uma chave nova, gerada aqui; o restaurante vem do tenant validado. */
export async function storeImage(
  restaurantId: string,
  kind: 'products' | 'logo',
  upload: ImageUpload
) {
  const key = `restaurants/${restaurantId}/${kind}/${randomUUID()}.${upload.extension}`
  await drive.use().copyFromFs(upload.tmpPath, key)
  return key
}

/** Remoção de melhor esforço: a falha é registrada (só a chave) e não derruba a operação. */
export async function removeImage(key: string | null | undefined) {
  if (!key) return
  try {
    await drive.use().delete(key)
  } catch (error) {
    logger.warn({ image_key: key, err: (error as Error).name }, 'falha ao remover imagem')
  }
}

export function contentTypeOf(key: string) {
  return TYPES[key.slice(key.lastIndexOf('.') + 1) as ImageExtension].mime
}

/** URL pública montada na resposta; o banco guarda só a chave. */
export function imageUrl(key: string | null) {
  if (!key) return null
  const base = (env.get('UPLOADS_PUBLIC_BASE', '/uploads') as string).replace(/\/+$/, '')
  return `${base}/${key}`
}
