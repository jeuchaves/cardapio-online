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

// Próximos status oferecidos como botão. `label` é o rótulo do detalhe; `short` é o da lista, que leva
// o número do pedido ao lado e não repete o texto do botão do detalhe. Cancelar é tratado à parte,
// com confirmação.
const NEXT_ACTIONS: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string; short: string }>
> = {
  pending: { status: "confirmed", label: "Confirmar pedido", short: "Confirmar" },
  confirmed: { status: "preparing", label: "Iniciar preparo", short: "Preparar" },
  preparing: { status: "ready", label: "Marcar como pronto", short: "Marcar pronto" },
  ready: { status: "completed", label: "Concluir pedido", short: "Concluir" },
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

// Visões da lista de pedidos. Cada uma é uma única consulta (a API filtra por um status); "Todos"
// não filtra. Nada de contadores nem de várias consultas por atualização.
export const STATUS_VIEWS: { value: OrderStatus | ""; label: string }[] = [
  { value: "pending", label: "Novos" },
  { value: "confirmed", label: "Confirmados" },
  { value: "preparing", label: "Em preparo" },
  { value: "ready", label: "Prontos" },
  { value: "", label: "Todos" },
];

// Tempo decorrido calculado no navegador a partir de created_at; passado um dia, mostra a data.
export function elapsedLabel(iso: string, now: number) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return formatDateTime(iso);
}

export const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
