// Leitura do cardápio público (GET /public/restaurants/:slug), feita no servidor do Next.js.
// Sem sessão e sem regra de negócio: o preço e o que é exibido vêm prontos da API.

export type PublicAddon = {
  id: string;
  name: string;
  description: string | null;
  price: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  addons: PublicAddon[];
};

export type PublicCategory = {
  id: string;
  name: string;
  description: string | null;
  products: PublicProduct[];
};

export type PublicRestaurant = {
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  logo_url: string | null;
  fulfillment_modes: ("dine_in" | "pickup")[];
  payment_methods: ("cash" | "card" | "pix")[];
};

export type PublicMenu = { restaurant: PublicRestaurant; categories: PublicCategory[] };

const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3333";

/** Devolve null quando o restaurante não existe ou está inativo (404 uniforme da API). */
export async function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  const response = await fetch(
    `${apiUrl}/api/v1/public/restaurants/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Não foi possível carregar o cardápio.");
  const payload = (await response.json()) as { data: PublicMenu };
  return payload.data;
}
