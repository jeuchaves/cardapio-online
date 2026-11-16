import { ApiError, api } from "@/lib/api";
import type { CartLine } from "@/lib/cart";

// Chamadas públicas de cotação, criação e acompanhamento do pedido (sem sessão). Os valores
// monetários chegam e saem como string; nada é calculado aqui (ADR 0001).

export type QuoteItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: string;
  addons: { id: string | null; name: string; unit_price: string }[];
  subtotal: string;
};

export type Quote = { items: QuoteItem[]; total: string };

export type OrderInput = {
  customer: { name: string; phone?: string };
  fulfillment_type: "dine_in" | "pickup";
  payment_method: "cash" | "card" | "pix";
  table_identifier?: string;
  notes?: string;
  items: CartPayloadItem[];
};

export type CreatedOrder = { order_number: number; tracking_token: string; status: string; total: string };

export type Tracking = {
  restaurant_name: string;
  order_number: number;
  status: OrderStatus;
  fulfillment_type: "dine_in" | "pickup";
  created_at: string;
  updated_at: string;
  items: { name: string; quantity: number; addons: string[]; subtotal: string }[];
  total: string;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

type CartPayloadItem = { product_id: string; quantity: number; addon_ids: string[] };

// O cliente envia só ids e quantidades; nenhum valor monetário
export function cartPayload(lines: CartLine[]): CartPayloadItem[] {
  return lines.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
    addon_ids: line.addons.map((addon) => addon.id),
  }));
}

export async function quoteCart(slug: string, lines: CartLine[], signal: AbortSignal) {
  const response = await api<{ data: Quote }>(
    `/public/restaurants/${encodeURIComponent(slug)}/cart/quote`,
    { method: "POST", body: { items: cartPayload(lines) }, signal },
  );
  return response.data;
}

export async function createOrder(slug: string, idempotencyKey: string, input: OrderInput) {
  const response = await api<{ data: CreatedOrder }>(
    `/public/restaurants/${encodeURIComponent(slug)}/orders`,
    { method: "POST", body: input, headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

export async function getTracking(token: string, signal?: AbortSignal) {
  const response = await api<{ data: Tracking }>(`/public/orders/${encodeURIComponent(token)}`, {
    signal,
  });
  return response.data;
}

// 422 ITEM_UNAVAILABLE traz { product_ids, addon_ids }. Devolve as linhas do carrinho afetadas.
export function unavailableLines(error: unknown, lines: CartLine[]): CartLine[] | null {
  if (!(error instanceof ApiError) || error.code !== "ITEM_UNAVAILABLE") return null;
  const extra = error.extra as { product_ids?: unknown; addon_ids?: unknown } | undefined;
  const products = new Set(Array.isArray(extra?.product_ids) ? extra.product_ids : []);
  const addons = new Set(Array.isArray(extra?.addon_ids) ? extra.addon_ids : []);
  return lines.filter(
    (line) => products.has(line.productId) || line.addons.some((addon) => addons.has(addon.id)),
  );
}

export const FINAL_STATUSES: OrderStatus[] = ["completed", "cancelled"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Recebido",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado",
};
