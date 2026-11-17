"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type TableCheck =
  | { state: "none" | "checking" | "invalid" }
  | { state: "valid"; name: string };

// Confere na API, antes do envio, se a mesa guardada do QR Code ainda vale (existe, está ativa e o
// consumo no local está habilitado). A API também valida ao criar o pedido; esta consulta só evita
// que a pessoa descubra o problema depois de preencher tudo. Sem resposta, a mesa segue como
// "checking" e nada é bloqueado.
export function useTableCheck(slug: string, table: string | null, ready: boolean): TableCheck {
  const key = table ? `${slug}:${table}` : null;
  const [result, setResult] = useState<{ key: string; check: TableCheck } | null>(null);

  useEffect(() => {
    if (!ready || !key || !table) return;
    const controller = new AbortController();
    api<{ data: { table?: { name: string } } }>(
      `/public/restaurants/${encodeURIComponent(slug)}?mesa=${encodeURIComponent(table)}`,
      { signal: controller.signal },
    )
      .then(({ data }) =>
        setResult({
          key,
          check: data.table ? { state: "valid", name: data.table.name } : { state: "invalid" },
        }),
      )
      .catch(() => {
        // Sem resposta: a API valida a mesa de novo ao criar o pedido
      });
    return () => controller.abort();
  }, [ready, key, slug, table]);

  if (!key) return { state: "none" };
  return result?.key === key ? result.check : { state: "checking" };
}
