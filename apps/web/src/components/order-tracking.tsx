"use client";

import Link from "next/link";
import { CircleCheckIcon, CircleDotIcon, CircleIcon, CopyIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, formatPrice } from "@/lib/api";
import { FINAL_STATUSES, STATUS_LABELS, getTracking, type OrderStatus, type Tracking } from "@/lib/public-order";
import { elapsedLabel } from "@/lib/panel-orders";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageLoading } from "@/components/list-states";
import { toast } from "@/components/ui/toast";

const POLL_MS = 15000;
const CLOCK_MS = 30000;

// Etapas do andamento, na ordem em que acontecem. O cancelamento é um desfecho à parte.
const STEPS: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "completed"];

type Problem = "not_found" | "rate_limited" | "network";

// Andamento por texto e ícone (a etapa atual leva aria-current="step"): a cor nunca é a única pista.
function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
        O restaurante cancelou este pedido.
      </p>
    );
  }
  const current = STEPS.indexOf(status);
  return (
    <ol aria-label="Andamento do pedido" className="grid gap-2">
      {STEPS.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "next";
        const Icon = state === "done" ? CircleCheckIcon : state === "current" ? CircleDotIcon : CircleIcon;
        return (
          // A chave inclui o estado: quando a API confirma um novo status, a etapa que mudou é
          // remontada e toca a entrada. Sem movimento com prefers-reduced-motion (motion-safe).
          <li
            key={`${step}-${state}`}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-lg px-2 text-base",
              state === "current" &&
                "bg-accent font-semibold text-accent-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-300",
              state === "next" && "text-muted-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-5 shrink-0",
                // Pulso discreto só enquanto o pedido está em andamento
                state === "current" && step !== "completed" && "motion-safe:animate-pulse",
              )}
            />
            <span>{STATUS_LABELS[step]}</span>
            <span className="sr-only">
              {state === "done" ? " (concluída)" : state === "current" ? " (etapa atual)" : " (próxima etapa)"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// O token fica só na URL: não é gravado em storage nem enviado a terceiros. A atualização é por
// polling e para quando o pedido chega a um status final ou a aba fica oculta.
export function OrderTracking({ token, slug }: { token: string; slug: string }) {
  const [order, setOrder] = useState<Tracking | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await getTracking(token, signal);
        setOrder(data);
        setProblem(null);
        setLoadedAt(Date.now());
        setNow(Date.now());
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

  // Relógio só para o texto "Atualizado há…" (nenhuma chamada à API)
  useEffect(() => {
    if (final) return;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [final]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.add({ title: "Link copiado.", type: "success" });
    } catch {
      toast.add({
        title: "Não foi possível copiar. Copie o endereço na barra do navegador.",
        type: "error",
      });
    }
  }

  if (loading) return <PageLoading label="Carregando o pedido…" />;

  if (problem === "not_found") {
    return (
      <div className="grid gap-4 p-4 text-center" role="alert">
        <p>Pedido não encontrado. Confira o link recebido.</p>
        <Link href={`/r/${encodeURIComponent(slug)}`} className={`${buttonVariants({ size: "lg" })} mx-auto`}>
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
            {!final && (
              <p className="text-sm text-muted-foreground">
                Atualizado {elapsedLabel(new Date(loadedAt).toISOString(), now)}
              </p>
            )}
          </section>

          <OrderProgress status={order.status} />

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
          <Button type="button" variant="outline" size="lg" onClick={() => void load()}>
            Atualizar
          </Button>
        )}
        {order && (
          <Button type="button" variant="outline" size="lg" onClick={() => void copyLink()}>
            <CopyIcon />
            Copiar link do pedido
          </Button>
        )}
        <Link href={`/r/${encodeURIComponent(slug)}`} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
