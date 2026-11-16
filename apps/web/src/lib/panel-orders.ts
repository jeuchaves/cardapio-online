import { STATUS_LABELS, type OrderStatus } from "@/lib/public-order";

// Pedidos no painel (GET/PATCH /tenant/:restaurantId/orders). Valores monetários chegam como string
// e são só exibidos. O frontend não decide transições: o mapa abaixo apenas escolhe quais botões
// mostrar; quem valida é a API (409 INVALID_TRANSITION).

export { STATUS_LABELS };
export type { OrderStatus };

export const STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];

export const FULFILLMENT_LABELS = { dine_in: "Consumo no local", pickup: "Retirada" } as const;
export const PAYMENT_LABELS = { cash: "Dinheiro", card: "Cartão", pix: "Pix" } as const;

export type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string;
  fulfillment_type: keyof typeof FULFILLMENT_LABELS;
  total: string;
  created_at: string;
};

export type OrderDetail = {
  id: string;
  order_number: number;
  status: OrderStatus;
  fulfillment_type: keyof typeof FULFILLMENT_LABELS;
  payment_method: keyof typeof PAYMENT_LABELS;
  customer: { name: string; phone: string | null };
  table: string | null;
  notes: string | null;
  total: string;
  created_at: string;
  updated_at: string;
  items: {
    name: string;
    quantity: number;
    unit_price: string;
    addons: { name: string; unit_price: string }[];
    subtotal: string;
  }[];
  history: { previous_status: OrderStatus | null; new_status: OrderStatus; created_at: string }[];
};

// Próximos status oferecidos como botão (rótulo da ação). Cancelar é tratado à parte, com confirmação.
const NEXT_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: "confirmed", label: "Confirmar pedido" },
  confirmed: { status: "preparing", label: "Iniciar preparo" },
  preparing: { status: "ready", label: "Marcar como pronto" },
  ready: { status: "completed", label: "Concluir pedido" },
};
const CANCELLABLE: OrderStatus[] = ["pending", "confirmed", "preparing"];

export const nextAction = (status: OrderStatus) => NEXT_ACTIONS[status] ?? null;
export const canCancel = (status: OrderStatus) => CANCELLABLE.includes(status);

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
