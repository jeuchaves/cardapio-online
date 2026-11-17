"use client";

import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormError, errorMessage } from "@/components/form-error";
import { EmptyList, ListSkeleton } from "@/components/list-states";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { ApiError, api, formatPrice } from "@/lib/api";
import {
  FULFILLMENT_LABELS,
  STATUSES,
  STATUS_VIEWS,
  STATUS_LABELS,
  elapsedLabel,
  formatDateTime,
  nextAction,
  type OrderRow,
  type OrderStatus,
} from "@/lib/panel-orders";
import { cn } from "@/lib/utils";

const PER_PAGE = 20;
const POLL_MS = 15000;

// Lista de pedidos do restaurante (owner e staff). Abre nos pedidos novos; cada visão é uma única
// consulta (a API filtra por um status). Atualiza a cada 15 s enquanto a aba está visível e na hora
// em que a pessoa volta a ela: nunca em segundo plano (ADR 0002, adendo 5). O avanço de status usa o
// mesmo PATCH do detalhe; quem valida a transição é a API.
export default function OrdersPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [status, setStatus] = useState<OrderStatus | "">("pending");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ orders: OrderRow[]; total: number } | null>(null);
  // Erro de carga some quando a próxima carga dá certo; erro de ação fica até a próxima ação.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  // Pedidos pendentes já vistos nesta sessão de tela; null até a primeira carga de uma visão com novos
  const seen = useRef<Set<string> | null>(null);
  // Trava síncrona contra dois toques antes de o estado `busyId` renderizar
  const advancing = useRef(false);

  usePageTitle(unseen.size > 0 ? `(${unseen.size}) Pedidos` : "Pedidos");

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (status) params.set("status", status);
    if (date) params.set("date", date);
    api<{ data: OrderRow[]; meta: { total: number } }>(
      `/tenant/${restaurantId}/orders?${params.toString()}`,
    )
      .then(({ data, meta }) => {
        if (!current) return;
        setResult({ orders: data, total: meta.total });
        setLoadError(null);
        setNow(Date.now());

        // Pedido novo: pendente que ainda não tinha aparecido. Só vale na primeira página de uma
        // visão que mostra pendentes e sem filtro de dia.
        if ((status === "" || status === "pending") && page === 1 && !date) {
          const pendingIds = data.filter((order) => order.status === "pending").map((order) => order.id);
          if (seen.current === null) {
            seen.current = new Set(pendingIds);
          } else {
            const known = seen.current;
            const fresh = pendingIds.filter((id) => !known.has(id));
            fresh.forEach((id) => known.add(id));
            setUnseen((previous) => {
              const next = new Set([...previous].filter((id) => pendingIds.includes(id)));
              fresh.forEach((id) => next.add(id));
              return next;
            });
          }
        }
      })
      .catch((err: unknown) => {
        if (current) setLoadError(errorMessage(err));
      });
    return () => {
      current = false;
    };
  }, [restaurantId, status, date, page, reloadKey]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = setInterval(refreshIfVisible, POLL_MS);
    // Ao voltar para a aba, atualiza na hora em vez de esperar o próximo ciclo
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [reload]);

  function chooseStatus(value: OrderStatus | "") {
    setStatus(value);
    setPage(1);
    setActionError(null);
  }

  function markSeen(id?: string) {
    setUnseen((previous) => {
      if (id === undefined) return new Set();
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  async function advance(order: OrderRow) {
    const action = nextAction(order.status);
    if (!action || advancing.current) return;
    advancing.current = true;
    setBusyId(order.id);
    setActionError(null);
    try {
      await api(`/tenant/${restaurantId}/orders/${order.id}/status`, {
        method: "PATCH",
        body: { status: action.status },
      });
      toast.add({
        title: `Pedido #${order.order_number}: ${STATUS_LABELS[action.status]}.`,
        type: "success",
      });
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.code === "INVALID_TRANSITION"
          ? `O status do pedido #${order.order_number} mudou. A lista foi atualizada; confira e tente de novo.`
          : errorMessage(err),
      );
    } finally {
      advancing.current = false;
      setBusyId(null);
      reload();
    }
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1;
  const filtered = status !== "pending" || date !== "";

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Button variant="outline" size="lg" onClick={reload}>
          Atualizar
        </Button>
      </div>

      {/* Região viva sempre presente: o texto aparece quando chegam pedidos novos e é anunciado */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {unseen.size > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted p-3 text-sm">
            <span className="font-medium">
              {unseen.size === 1 ? "1 novo pedido" : `${unseen.size} novos pedidos`}
            </span>
            <Button variant="outline" size="lg" onClick={() => markSeen()}>
              Marcar como vistos
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div role="group" aria-label="Visões de pedidos" className="flex flex-wrap gap-2">
          {STATUS_VIEWS.map((view) => (
            <Button
              key={view.value}
              variant={status === view.value ? "default" : "outline"}
              size="lg"
              aria-pressed={status === view.value}
              onClick={() => chooseStatus(view.value)}
            >
              {view.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="filter-status">Status</Label>
            <NativeSelect
              id="filter-status"
              value={status}
              onChange={(event) => chooseStatus(event.target.value as OrderStatus | "")}
            >
              <NativeSelectOption value="">Todos</NativeSelectOption>
              {STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {STATUS_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filter-date">Dia</Label>
            <Input
              id="filter-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {filtered && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                chooseStatus("pending");
                setDate("");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <FormError message={actionError} />
      <FormError message={loadError} />
      {result === null ? (
        loadError ? null : <ListSkeleton />
      ) : result.orders.length === 0 ? (
        <EmptyList>{status === "pending" && !date ? "Nenhum pedido novo." : "Nenhum pedido encontrado."}</EmptyList>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {result.orders.map((order) => {
            const action = nextAction(order.status);
            const isNew = unseen.has(order.id);
            return (
              <li key={order.id}>
                <Card className={cn("transition-colors", isNew && "ring-2 ring-primary")}>
                  <CardContent className="grid gap-3">
                    <Link
                      href={`/painel/${restaurantId}/pedidos/${order.id}`}
                      onClick={() => markSeen(order.id)}
                      className="grid gap-1 rounded-md outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-semibold">
                          Pedido #{order.order_number}
                          {isNew ? <Badge>Novo</Badge> : null}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <div className="text-sm">{order.customer_name}</div>
                      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                        <span>
                          {FULFILLMENT_LABELS[order.fulfillment_type]} ·{" "}
                          <time dateTime={order.created_at} title={formatDateTime(order.created_at)}>
                            {elapsedLabel(order.created_at, now)}
                          </time>
                        </span>
                        <span className="font-medium text-foreground">{formatPrice(order.total)}</span>
                      </div>
                    </Link>
                    {action ? (
                      <Button variant="outline" size="lg" disabled={busyId !== null} onClick={() => void advance(order)}>
                        {action.short} #{order.order_number}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {result && result.total > PER_PAGE && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="lg" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="lg" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
