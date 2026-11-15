import { randomInt } from 'node:crypto'
import RestaurantTable from '#models/restaurant_table'
import { isUniqueViolation } from '#support/request_helpers'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const LENGTH = 10
const ATTEMPTS = 5
const IDENTIFIER_UNIQUE = 'restaurant_tables_restaurant_identifier_unique'

/** 10 caracteres a-z0-9 sorteados com crypto.randomInt: não sequencial nem previsível. */
export function generateTableIdentifier() {
  let identifier = ''
  for (let i = 0; i < LENGTH; i++) identifier += ALPHABET[randomInt(ALPHABET.length)]
  return identifier
}

/**
 * Cria a mesa com um identificador novo. A restrição UNIQUE (restaurant_id, identifier) é a
 * garantia final: em colisão (praticamente impossível) sorteia outro e tenta de novo.
 */
export async function createTable(
  restaurantId: string,
  name: string,
  generate: () => string = generateTableIdentifier
) {
  for (let attempt = 1; ; attempt++) {
    try {
      // isActive explícito: o model criado não lê de volta o default do banco
      return await RestaurantTable.create({
        restaurantId,
        name,
        identifier: generate(),
        isActive: true,
      })
    } catch (error) {
      if (!isUniqueViolation(error, IDENTIFIER_UNIQUE) || attempt === ATTEMPTS) throw error
    }
  }
}
