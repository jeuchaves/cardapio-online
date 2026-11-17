"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { EmptyList, ListSkeleton } from "@/components/list-states";
import { NewItemCard } from "@/components/new-item-card";
import { QrCodeCard } from "@/components/qr-code-card";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type RestaurantTable } from "@/lib/api";
import { cn } from "@/lib/utils";
import { restaurantMenuUrl, tableMenuUrl } from "@/lib/public-url";

// QR Codes do restaurante e das mesas. Mesas são do dono (a API recusa o staff com 403).
export default function TablesPage() {
  usePageTitle("QR Codes");
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const isOwner = restaurant?.role === "owner";
  const base = `/tenant/${restaurantId}/tables`;

  const [tables, setTables] = useState<RestaurantTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    if (!isOwner) return;
    api<{ data: RestaurantTable[] }>(`/tenant/${restaurantId}/tables`)
      .then(({ data }) => setTables(data))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [restaurantId, isOwner, reloadKey]);

  if (!restaurant || !isOwner) {
    return <FormError message="Somente o dono do restaurante acessa os QR Codes." />;
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setFields({});
    try {
      await api(base, { method: "POST", body: { name: new FormData(formElement).get("name") } });
      formElement.reset();
      toast.add({ title: "Mesa criada.", type: "success" });
      load();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  }

  // Renomear não muda o identificador: o QR Code já impresso continua valendo.
  async function rename(event: React.FormEvent<HTMLFormElement>, table: RestaurantTable) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    setError(null);
    setFields({});
    try {
      await api(`${base}/${table.id}`, { method: "PATCH", body: { name } });
      setEditingId(null);
      toast.add({ title: "Mesa renomeada.", type: "success" });
      load();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  }

  async function setActive(table: RestaurantTable, isActive: boolean) {
    setError(null);
    try {
      await api(`${base}/${table.id}`, { method: "PATCH", body: { is_active: isActive } });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(table: RestaurantTable) {
    setError(null);
    try {
      await api(`${base}/${table.id}`, { method: "DELETE" });
      toast.add({ title: "Mesa excluída.", type: "success" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-4 print:grid-cols-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:col-span-full">
        <div>
          <h1 className="text-xl font-semibold">QR Codes</h1>
          <p className="hidden text-sm text-muted-foreground print:block">{restaurant.name}</p>
        </div>
        <Button type="button" variant="outline" size="lg" className="print:hidden" onClick={() => window.print()}>
          Imprimir QR Codes
        </Button>
      </div>
      <FormError message={error} />

      <Card className="break-inside-avoid">
        <CardHeader>
          <CardTitle>Cardápio do restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          <QrCodeCard url={restaurantMenuUrl(restaurant.slug)} filename={`qr-${restaurant.slug}`} />
          <p className="mt-3 text-sm text-muted-foreground print:hidden">
            Alterar o endereço (slug) do restaurante invalida os QR Codes já impressos.
          </p>
        </CardContent>
      </Card>

      <NewItemCard title="Nova mesa" forceOpen={tables?.length === 0}>
        <form onSubmit={create} className="flex max-w-2xl flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field name="name" label="Nome da mesa" maxLength={60} error={fields.name} required />
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto sm:justify-self-start">Criar mesa</Button>
        </form>
      </NewItemCard>

      {tables === null ? (
        error ? null : <ListSkeleton />
      ) : tables.length === 0 ? (
        <EmptyList>Nenhuma mesa cadastrada.</EmptyList>
      ) : (
        tables.map((table) => (
          <Card key={table.id} className={cn("break-inside-avoid", !table.is_active && "print:hidden")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{table.name}</span>
                <Badge variant={table.is_active ? "secondary" : "outline"} className="print:hidden">
                  {table.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QrCodeCard
                url={tableMenuUrl(restaurant.slug, table.identifier)}
                filename={`qr-${restaurant.slug}-${table.identifier}`}
              />
              {editingId === table.id ? (
                <form
                  onSubmit={(event) => void rename(event, table)}
                  className="flex flex-wrap items-end gap-3 print:hidden"
                >
                  <div className="min-w-48 flex-1">
                    <Field
                      name="name"
                      label="Nome da mesa"
                      defaultValue={table.name}
                      maxLength={60}
                      error={fields.name}
                      required
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full sm:w-auto sm:justify-self-start">Salvar</Button>
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 print:hidden">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFields({});
                    setEditingId(table.id);
                  }}
                >
                  Renomear
                </Button>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`active-${table.id}`}
                    checked={table.is_active}
                    onCheckedChange={(checked) => setActive(table, checked)}
                  />
                  <Label htmlFor={`active-${table.id}`}>Ativa</Label>
                </div>
                <ConfirmDelete
                  title={`Excluir a mesa "${table.name}"?`}
                  description="O QR Code impresso dela deixa de identificar a mesa."
                  onConfirm={() => remove(table)}
                />
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
