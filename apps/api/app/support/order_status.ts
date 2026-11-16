import { type ORDER_STATUSES } from '#validators/order'

export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Única fonte das transições do restaurante (ROADMAP 5.3). Cancelamento só até `preparing`;
// `completed` e `cancelled` são finais. O cliente não altera pedidos na v1.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
}

export function canTransition(from: string, to: string) {
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to as OrderStatus)
}
