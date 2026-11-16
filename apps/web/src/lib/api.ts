// Único ponto de chamada à API. Mesma origem: o navegador envia o cookie de sessão
// e o header Origin sozinho (ADR 0002), sem CORS.

export type FieldError = { field?: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: FieldError[],
    // `details` que não é lista de erros por campo (ex.: ITEM_UNAVAILABLE devolve um objeto)
    readonly extra?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = undefined>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const hasBody = init.body !== undefined;
  // FormData (upload de imagem): o navegador define o Content-Type com o boundary
  const isForm = init.body instanceof FormData;
  const response = await fetch(`/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(hasBody && !isForm ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal,
    body: hasBody ? (isForm ? (init.body as FormData) : JSON.stringify(init.body)) : undefined,
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code ?? "UNKNOWN",
      payload?.message ?? "Erro inesperado. Tente novamente.",
      Array.isArray(payload?.details) ? payload.details : undefined,
      Array.isArray(payload?.details) ? undefined : payload?.details,
    );
  }
  return payload as T;
}

export type Role = "owner" | "staff";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  is_platform_admin: boolean;
  must_change_password: boolean;
};

export type SessionRestaurant = {
  id: string;
  name: string;
  slug: string;
  role: Role;
};

export type Me = { user: SessionUser; restaurants: SessionRestaurant[] };

export type RestaurantData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  accepts_dine_in: boolean;
  accepts_pickup: boolean;
  accepts_cash: boolean;
  accepts_card: boolean;
  accepts_pix: boolean;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Addon = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  is_available: boolean;
};

export type RestaurantTable = {
  id: string;
  name: string;
  identifier: string;
  is_active: boolean;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
  addons: Addon[];
};

// Preço chega e sai como string decimal; só troca o separador para exibir (sem number).
export function formatPrice(price: string) {
  return `R$ ${price.replace(".", ",")}`;
}
