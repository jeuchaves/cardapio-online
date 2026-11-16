import { createHash } from 'node:crypto'

type OrderInput = {
  customer: { name: string; phone?: string }
  fulfillment_type: string
  payment_method: string
  table_identifier?: string
  notes?: string
  items: { product_id: string; quantity: number; addon_ids?: string[] }[]
}

/**
 * SHA-256 do payload normalizado recebido do cliente (ROADMAP 5.5, passo 2): textos já aparados,
 * itens e adicionais ordenados, campos em ordem fixa e sem a chave de idempotência. É calculado
 * antes de consultar preços, então não depende do catálogo.
 */
export function hashOrderInput(input: OrderInput) {
  const normalized = {
    customer: { name: input.customer.name, phone: input.customer.phone ?? null },
    fulfillment_type: input.fulfillment_type,
    payment_method: input.payment_method,
    table_identifier: input.table_identifier ?? null,
    notes: input.notes ?? null,
    items: input.items
      .map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        addon_ids: [...(item.addon_ids ?? [])].sort(),
      }))
      .sort((a, b) => (a.product_id < b.product_id ? -1 : 1)),
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
