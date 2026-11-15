import vine from '@vinejs/vine'

const name = () => vine.string().trim().minLength(1).maxLength(80)
const description = () => vine.string().trim().maxLength(500).nullable().optional()
// O formato do preço é validado em #support/money: aqui só garante string (JSON number é rejeitado)
const price = () => vine.string()

export const createAddonValidator = vine.create({
  name: name(),
  description: description(),
  price: price(),
  is_available: vine.boolean({ strict: true }).optional(),
})

export const updateAddonValidator = vine.create({
  name: name().optional(),
  description: description(),
  price: price().optional(),
  is_available: vine.boolean({ strict: true }).optional(),
})
