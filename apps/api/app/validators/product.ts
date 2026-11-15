import vine from '@vinejs/vine'

const name = () => vine.string().trim().minLength(1).maxLength(120)
const description = () => vine.string().trim().maxLength(1000).nullable().optional()
const sortOrder = () => vine.number().withoutDecimals().min(0).max(9999)
// O formato do preço é validado em #support/money: aqui só garante string (JSON number é rejeitado)
const price = () => vine.string()
const categoryId = () => vine.string().uuid()

export const listProductsValidator = vine.create({
  category_id: categoryId().optional(),
  page: vine.number().withoutDecimals().min(1).max(10000).optional(),
  per_page: vine.number().withoutDecimals().min(1).max(100).optional(),
})

export const createProductValidator = vine.create({
  category_id: categoryId(),
  name: name(),
  description: description(),
  price: price(),
  sort_order: sortOrder().optional(),
  is_available: vine.boolean({ strict: true }).optional(),
})

export const updateProductValidator = vine.create({
  category_id: categoryId().optional(),
  name: name().optional(),
  description: description(),
  price: price().optional(),
  sort_order: sortOrder().optional(),
  is_available: vine.boolean({ strict: true }).optional(),
})

export const replaceProductAddonsValidator = vine.create({
  addon_ids: vine.array(vine.string().uuid()).maxLength(10),
})
