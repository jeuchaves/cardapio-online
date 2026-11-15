import Big from 'big.js'
import { validationError } from '#support/request_helpers'

// ADR 0001: string decimal com até 8 inteiros e 2 casas; sem sinal, expoente ou espaços
const PRICE = /^\d{1,8}(\.\d{1,2})?$/

/**
 * Valida o preço recebido e o devolve com duas casas. O big.js só valida e formata:
 * nenhum valor monetário passa por number.
 */
export function parsePrice(value: string) {
  if (!PRICE.test(value)) {
    throw validationError('price', 'Informe o preço como texto decimal, ex.: 12.50.')
  }
  return new Big(value).toFixed(2)
}
