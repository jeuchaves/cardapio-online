// URL pública do cardápio, gravada nos QR Codes (ADR 0003). A base vem da variável de
// ambiente; sem ela (desenvolvimento), usa a origem em que o painel está aberto.
// Só roda no navegador.
function publicBase() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || window.location.origin).replace(/\/+$/, "");
}

export function restaurantMenuUrl(slug: string) {
  return `${publicBase()}/r/${encodeURIComponent(slug)}`;
}

// A mesa é só contexto do pedido: o QR leva ao mesmo cardápio público, sem token nem credencial.
export function tableMenuUrl(slug: string, identifier: string) {
  return `${restaurantMenuUrl(slug)}?mesa=${encodeURIComponent(identifier)}`;
}
