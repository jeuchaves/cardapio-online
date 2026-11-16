import vine from '@vinejs/vine'

// Limites da seção 4.5 do ROADMAP. Valores monetários nunca são aceitos na entrada.
export const ORDER_FIELDS = [
  'customer',
  'fulfillment_type',
  'payment_method',
  'table_identifier',
  'notes',
  'items',
]
export const CUSTOMER_FIELDS = ['name', 'phone']
export const ITEM_FIELDS = ['product_id', 'quantity', 'addon_ids']

// Itens do carrinho: mesmas regras na cotação e na criação do pedido
function cartItems() {
  return vine
    .array(
      vine.object({
        product_id: vine.string().uuid(),
        quantity: vine.number({ strict: true }).withoutDecimals().min(1).max(20),
        addon_ids: vine.array(vine.string().uuid()).maxLength(10).distinct().optional(),
      })
    )
    .minLength(1)
    .maxLength(30)
    .distinct('product_id')
}

export const QUOTE_FIELDS = ['items']

export const createQuoteValidator = vine.create({ items: cartItems() })

export const createOrderValidator = vine.create({
  customer: vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    phone: vine.string().trim().maxLength(20).optional(),
  }),
  fulfillment_type: vine.enum(['dine_in', 'pickup']),
  payment_method: vine.enum(['cash', 'card', 'pix']),
  table_identifier: vine
    .string()
    .trim()
    .regex(/^[a-z0-9]{1,60}$/)
    .optional(),
  notes: vine.string().trim().maxLength(500).optional(),
  items: cartItems(),
})

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
] as const

export const LIST_ORDERS_FIELDS = ['status', 'date', 'page', 'per_page']

// Dia civil validado em orders_controller (a data precisa existir no calendário)
export const listOrdersValidator = vine.create({
  status: vine.enum(ORDER_STATUSES).optional(),
  date: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: vine.number().withoutDecimals().min(1).max(10000).optional(),
  per_page: vine.number().withoutDecimals().min(1).max(100).optional(),
})
