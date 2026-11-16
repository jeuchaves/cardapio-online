"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormError, errorMessage } from "@/components/form-error";
import { EmptyList, ListSkeleton } from "@/components/list-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatPrice } from "@/lib/api";
import {
  FULFILLMENT_LABELS,
  STATUSES,
  STATUS_LABELS,
  formatDateTime,
  type OrderRow,
} from "@/lib/panel-orders";

const PER_PAGE = 20;
const POLL_MS = 15000;

// Lista de pedidos do restaurante (owner e staff). Recarga manual e periódica simples.
export default function OrdersPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ orders: OrderRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);

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
        setError(null);
      })
      .catch((err: unknown) => {
        if (current) setError(errorMessage(err));
      });
    return () => {
      current = false;
    };
  }, [restaurantId, status, date, page, reloadKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const pages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Button variant="outline" size="sm" onClick={reload}>
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <select
            id="filter-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Todos</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
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
        {(status || date) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("");
              setDate("");
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <FormError message={error} />
      {result === null ? (
        error ? null : <ListSkeleton />
      ) : result.orders.length === 0 ? (
        <EmptyList>Nenhum pedido encontrado.</EmptyList>
      ) : (
        <ul className="grid gap-3">
          {result.orders.map((order) => (
            <li key={order.id}>
              <Link href={`/painel/${restaurantId}/pedidos/${order.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Pedido #{order.order_number}</span>
                      <Badge variant={order.status === "pending" ? "default" : "secondary"}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <div className="text-sm">{order.customer_name}</div>
                    <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                      <span>
                        {FULFILLMENT_LABELS[order.fulfillment_type]} · {formatDateTime(order.created_at)}
                      </span>
                      <span className="font-medium text-foreground">{formatPrice(order.total)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && result.total > PER_PAGE && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
