import vine from '@vinejs/vine'
import { ORDER_STATUSES } from '#validators/order'

export const ORDER_STATUS_FIELDS = ['status']

export const updateOrderStatusValidator = vine.create({
  status: vine.enum(ORDER_STATUSES),
})
