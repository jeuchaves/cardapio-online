import vine from '@vinejs/vine'

const name = () => vine.string().trim().minLength(1).maxLength(80)
const description = () => vine.string().trim().maxLength(500).nullable().optional()
const sortOrder = () => vine.number().withoutDecimals().min(0).max(9999)

export const createCategoryValidator = vine.create({
  name: name(),
  description: description(),
  sort_order: sortOrder().optional(),
  is_active: vine.boolean({ strict: true }).optional(),
})

export const updateCategoryValidator = vine.create({
  name: name().optional(),
  description: description(),
  sort_order: sortOrder().optional(),
  is_active: vine.boolean({ strict: true }).optional(),
})
