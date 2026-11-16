"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, formatPrice } from "@/lib/api";
import { FINAL_STATUSES, STATUS_LABELS, getTracking, type Tracking } from "@/lib/public-order";
import { Button, buttonVariants } from "@/components/ui/button";

const POLL_MS = 15000;

type Problem = "not_found" | "rate_limited" | "network";

// O token fica só na URL: não é gravado em storage nem enviado a terceiros. A atualização é por
// polling e para quando o pedido chega a um status final ou a aba fica oculta.
export function OrderTracking({ token, slug }: { token: string; slug: string }) {
  const [order, setOrder] = useState<Tracking | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await getTracking(token, signal);
        setOrder(data);
        setProblem(null);
      } catch (error) {
        if (signal?.aborted) return;
        if (error instanceof ApiError && error.status === 404) setProblem("not_found");
        else if (error instanceof ApiError && error.status === 429) setProblem("rate_limited");
        else setProblem("network");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [token],
  );

  const final = order !== null && FINAL_STATUSES.includes(order.status);

  useEffect(() => {
    const controller = new AbortController();
    // Busca inicial de dados externos (API); os setState ocorrem após a resposta
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (final || problem === "not_found") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [final, problem, load]);

  if (loading) return <p className="p-4 text-center text-muted-foreground">Carregando…</p>;

  if (problem === "not_found") {
    return (
      <div className="grid gap-4 p-4 text-center" role="alert">
        <p>Pedido não encontrado. Confira o link recebido.</p>
        <Link href={`/r/${encodeURIComponent(slug)}`} className={`${buttonVariants()} mx-auto`}>
          Ver cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 p-4">
      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          {problem === "rate_limited"
            ? "Muitas consultas. Aguarde um minuto e atualize."
            : "Não foi possível atualizar. Verifique sua conexão."}
        </p>
      )}
      {order && (
        <>
          <section className="grid gap-1 rounded-xl p-4 ring-1 ring-foreground/10">
            <p className="text-sm text-muted-foreground">{order.restaurant_name}</p>
            <p className="text-lg font-semibold" data-testid="order-number">
              Pedido #{order.order_number}
            </p>
            <p className="text-base" data-testid="order-status" role="status">
              {STATUS_LABELS[order.status]}
            </p>
          </section>

          <ul className="grid gap-2">
            {order.items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  {item.quantity}× {item.name}
                  {item.addons.length > 0 && (
                    <span className="block text-muted-foreground">+ {item.addons.join(", ")}</span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold" data-testid="order-total">
              {formatPrice(order.total)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Pagamento presencial. Guarde este link para acompanhar o pedido: quem tiver o link vê o
            andamento.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {!final && (
          <Button type="button" variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
        )}
        <Link href={`/r/${encodeURIComponent(slug)}`} className={buttonVariants({ variant: "ghost" })}>
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
