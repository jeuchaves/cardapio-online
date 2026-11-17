"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { EmptyList, ListSkeleton } from "@/components/list-states";
import { NewItemCard } from "@/components/new-item-card";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, formatPrice, type Addon } from "@/lib/api";

function AddonForm({
  addon,
  fields,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  addon?: Addon;
  fields: Record<string, string>;
  submitLabel: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <Field
        name="name"
        label="Nome"
        defaultValue={addon?.name}
        maxLength={80}
        error={fields.name}
        required
      />
      <Field
        name="price"
        label="Preço (ex.: 3,50)"
        inputMode="decimal"
        defaultValue={addon?.price.replace(".", ",")}
        maxLength={11}
        error={fields.price}
        required
      />
      <div className="sm:col-span-2">
        <Field
          name="description"
          label="Descrição"
          defaultValue={addon?.description ?? ""}
          maxLength={500}
          error={fields.description}
        />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="lg" className="w-full sm:w-auto sm:justify-self-start">{submitLabel}</Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// O preço segue como texto até a API (que valida e calcula); só a vírgula vira ponto.
function readForm(form: FormData) {
  return {
    name: form.get("name"),
    description: String(form.get("description") ?? "").trim() || null,
    price: String(form.get("price") ?? "").trim().replace(",", "."),
  };
}

export default function AddonsPage() {
  usePageTitle("Adicionais");
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const isOwner = restaurants.find((r) => r.id === restaurantId)?.role === "owner";
  const base = `/tenant/${restaurantId}/addons`;

  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    api<{ data: Addon[] }>(`/tenant/${restaurantId}/addons`)
      .then(({ data }) => setAddons(data))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [restaurantId, reloadKey]);

  async function save(
    event: React.FormEvent<HTMLFormElement>,
    request: { path: string; method: string },
    onDone: () => void,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setFields({});
    try {
      await api(request.path, { method: request.method, body: readForm(new FormData(formElement)) });
      onDone();
      toast.add({ title: "Adicional salvo.", type: "success" });
      load();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  }

  async function setAvailable(addon: Addon, isAvailable: boolean) {
    setError(null);
    try {
      await api(`${base}/${addon.id}`, { method: "PATCH", body: { is_available: isAvailable } });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(addon: Addon) {
    setError(null);
    try {
      await api(`${base}/${addon.id}`, { method: "DELETE" });
      toast.add({ title: "Adicional excluído.", type: "success" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Adicionais</h1>
      <FormError message={error} />

      <NewItemCard title="Novo adicional" forceOpen={addons?.length === 0}>
        <AddonForm
          fields={editingId ? {} : fields}
          submitLabel="Criar adicional"
          onSubmit={(event) => {
            const formElement = event.currentTarget;
            void save(event, { path: base, method: "POST" }, () => formElement.reset());
          }}
        />
      </NewItemCard>

      {addons === null ? (
        error ? null : <ListSkeleton />
      ) : addons.length === 0 ? (
        <EmptyList>Nenhum adicional cadastrado.</EmptyList>
      ) : (
        addons.map((addon) => (
          <Card key={addon.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>
                  {addon.name} <span className="font-normal">· {formatPrice(addon.price)}</span>
                </span>
                <Badge variant={addon.is_available ? "secondary" : "outline"}>
                  {addon.is_available ? "Disponível" : "Indisponível"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {editingId === addon.id ? (
                <AddonForm
                  addon={addon}
                  fields={fields}
                  submitLabel="Salvar"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(event) =>
                    void save(event, { path: `${base}/${addon.id}`, method: "PATCH" }, () =>
                      setEditingId(null),
                    )
                  }
                />
              ) : (
                <>
                  {addon.description ? (
                    <p className="text-sm text-muted-foreground">{addon.description}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFields({});
                        setEditingId(addon.id);
                      }}
                    >
                      Editar
                    </Button>
                    {isOwner ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`available-${addon.id}`}
                            checked={addon.is_available}
                            onCheckedChange={(checked) => setAvailable(addon, checked)}
                          />
                          <Label htmlFor={`available-${addon.id}`}>Disponível</Label>
                        </div>
                        <ConfirmDelete
                          title={`Excluir o adicional "${addon.name}"?`}
                          description="Ele sai de todos os produtos que o usam."
                          onConfirm={() => remove(addon)}
                        />
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
