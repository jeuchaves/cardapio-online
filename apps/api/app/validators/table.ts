import vine from '@vinejs/vine'

const name = () => vine.string().trim().minLength(1).maxLength(60)

export const createTableValidator = vine.create({
  name: name(),
})

export const updateTableValidator = vine.create({
  name: name().optional(),
  is_active: vine.boolean({ strict: true }).optional(),
})
