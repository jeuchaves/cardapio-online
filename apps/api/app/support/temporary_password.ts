import { randomInt } from 'node:crypto'

// Sem caracteres ambíguos (0/O, 1/l/I). 16 caracteres de 56 símbolos: cerca de 93 bits.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function generateTemporaryPassword(length = 16) {
  let password = ''
  for (let i = 0; i < length; i++) password += ALPHABET[randomInt(ALPHABET.length)]
  return password
}
