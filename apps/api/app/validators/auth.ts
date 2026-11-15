import vine from '@vinejs/vine'

// Política de senha (D2): 10 a 128 caracteres, sem regras de composição.
// Os checks "diferente da atual" e "diferente do e-mail" ficam no controller.
export const loginValidator = vine.create({
  email: vine.string().trim().maxLength(254),
  password: vine.string().minLength(1).maxLength(128),
})

export const changePasswordValidator = vine.create({
  current_password: vine.string().minLength(1).maxLength(128),
  new_password: vine.string().minLength(10).maxLength(128),
})
