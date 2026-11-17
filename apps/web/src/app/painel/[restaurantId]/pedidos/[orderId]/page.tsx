"use client";

import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormError, errorMessage } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { ListSkeleton } from "@/components/list-states";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api, formatPrice } from "@/lib/api";
import {
  FULFILLMENT_LABELS,
  PAYMENT_LABELS,
  STATUS_LABELS,
  canCancel,
  formatDateTime,
  nextAction,
  phoneHref,
  type OrderDetail,
  type OrderStatus,
} from "@/lib/panel-orders";

const POLL_MS = 15000;

// Detalhe do pedido e transições de status. Os botões vêm de um mapa de apresentação; a API é a
// autoridade e, se o status mudou em outro lugar (409), a tela avisa e recarrega. A atualização
// periódica só roda com a aba visível e acontece na hora ao voltar para ela (ADR 0002, adendo 5).
export default function OrderDetailPage() {
  const { restaurantId, orderId } = useParams<{ restaurantId: string; orderId: string }>();
  const base = `/tenant/${restaurantId}/orders/${orderId}`;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  usePageTitle(order ? `Pedido #${order.order_number}` : "Pedido");
  const [notFound, setNotFound] = useState(false);
  // Erro de carga some quando a próxima carga dá certo; erro de ação (como o conflito de status)
  // fica visível depois do recarregamento, até a próxima ação.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);
  // Trava síncrona contra dois cliques antes de o estado `busy` renderizar
  const pending = useRef(false);

  useEffect(() => {
    let current = true;
    api<{ data: OrderDetail }>(base)
      .then(({ data }) => {
        if (!current) return;
        setOrder(data);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!current) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setLoadError(errorMessage(err));
      });
    return () => {
      current = false;
    };
  }, [base, reloadKey]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") setReloadKey((key) => key + 1);
    };
    const timer = setInterval(refreshIfVisible, POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, []);

  async function changeStatus(status: OrderStatus) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await api(`${base}/status`, { method: "PATCH", body: { status } });
      toast.add({ title: `Status alterado para "${STATUS_LABELS[status]}".`, type: "success" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        setActionError("O status deste pedido mudou. Os dados foram atualizados; confira e tente de novo.");
      } else {
        setActionError(errorMessage(err));
      }
    } finally {
      pending.current = false;
      setBusy(false);
      reload();
    }
  }

  if (notFound) {
    return (
      <div className="grid gap-3">
        <FormError message="Pedido não encontrado." />
        <Link
          href={`/painel/${restaurantId}/pedidos`}
          className="inline-flex min-h-11 w-fit items-center text-sm underline"
        >
          Voltar aos pedidos
        </Link>
      </div>
    );
  }
  if (order === null) return loadError ? <FormError message={loadError} /> : <ListSkeleton />;

  const action = nextAction(order.status);

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <div className="grid gap-4 lg:col-span-3">
        <Link
          href={`/painel/${restaurantId}/pedidos`}
          className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Pedidos
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Pedido #{order.order_number}</h1>
          <OrderStatusBadge status={order.status} data-testid="order-status" />
        </div>

        <FormError message={actionError} />
        <FormError message={loadError} />

        {(action || canCancel(order.status)) && (
          <div className="flex flex-wrap items-center gap-3">
            {action && (
              <Button size="lg" disabled={busy} onClick={() => void changeStatus(action.status)}>
                {action.label}
              </Button>
            )}
            {canCancel(order.status) && (
              <ConfirmDelete
                label="Cancelar pedido"
                size="lg"
                title={`Cancelar o pedido #${order.order_number}?`}
                description="O cancelamento não pode ser desfeito."
                disabled={busy}
                onConfirm={() => changeStatus("cancelled")}
              />
            )}
          </div>
        )}
      </div>

      <Card className="lg:col-start-3 lg:row-start-2">
        <CardHeader>
          <CardTitle as="h2">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p>{order.customer.name}</p>
          {order.customer.phone && (
            <p>
              <a
                href={phoneHref(order.customer.phone)}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {order.customer.phone}
              </a>
            </p>
          )}
          <p className="text-muted-foreground">
            {FULFILLMENT_LABELS[order.fulfillment_type]}
            {order.table ? ` · ${order.table}` : ""} · {PAYMENT_LABELS[order.payment_method]}
          </p>
          <p className="text-muted-foreground">Recebido em {formatDateTime(order.created_at)}</p>
          {order.notes && <p className="mt-2 whitespace-pre-wrap">Observações: {order.notes}</p>}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2">
        <CardHeader>
          <CardTitle as="h2">Itens</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ul className="grid gap-2 text-sm">
            {order.items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3">
                <span>
                  {item.quantity}× {item.name}
                  {item.addons.map((addon) => (
                    <span key={addon.name} className="block text-muted-foreground">
                      + {addon.name}
                    </span>
                  ))}
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
        </CardContent>
      </Card>

      <Card className="lg:col-start-3 lg:row-start-3">
        <CardHeader>
          <CardTitle as="h2">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-1 text-sm">
            {order.history.map((entry, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span>
                  {entry.previous_status ? `${STATUS_LABELS[entry.previous_status]} → ` : ""}
                  {STATUS_LABELS[entry.new_status]}
                </span>
                <span className="text-muted-foreground">{formatDateTime(entry.created_at)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
