"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormError, useFormFeedback } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { EmptyList, ListSkeleton } from "@/components/list-states";
import { NewItemCard } from "@/components/new-item-card";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type Category } from "@/lib/api";

function CategoryForm({
  category,
  fields,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  category?: Category;
  fields: Record<string, string>;
  submitLabel: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  return (
    <form noValidate onSubmit={onSubmit} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <Field
        name="name"
        label="Nome"
        defaultValue={category?.name}
        maxLength={80}
        error={fields.name}
        required
      />
      <Field
        name="sort_order"
        label="Ordem (0 a 9999)"
        type="number"
        min={0}
        max={9999}
        step={1}
        defaultValue={category?.sort_order ?? 0}
        hint="Número menor aparece primeiro; com o mesmo número, vale a ordem alfabética."
        error={fields.sort_order}
      />
      <div className="sm:col-span-2">
        <Field
          name="description"
          label="Descrição"
          defaultValue={category?.description ?? ""}
          maxLength={500}
          error={fields.description}
        />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="lg" className="flex-1 sm:flex-none">{submitLabel}</Button>
        {onCancel ? (
          <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// A ordem é um inteiro de exibição, não um valor monetário.
function readForm(form: FormData) {
  const sortOrder = String(form.get("sort_order") ?? "").trim();
  return {
    name: form.get("name"),
    description: String(form.get("description") ?? "").trim() || null,
    ...(sortOrder !== "" && { sort_order: Number(sortOrder) }),
  };
}

export default function CategoriesPage() {
  usePageTitle("Categorias");
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const isOwner = restaurants.find((r) => r.id === restaurantId)?.role === "owner";
  const base = `/tenant/${restaurantId}/categories`;

  const [categories, setCategories] = useState<Category[] | null>(null);
  const { error, kind, fields, setFields, clearError, reset, report, fail, invalid } = useFormFeedback();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    api<{ data: Category[] }>(`/tenant/${restaurantId}/categories`)
      .then(({ data }) => setCategories(data))
      .catch(report);
  }, [restaurantId, reloadKey, report]);

  async function save(
    event: React.FormEvent<HTMLFormElement>,
    request: { path: string; method: string },
    onDone: () => void,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    reset();
    if (invalid(formElement)) return;
    try {
      await api(request.path, { method: request.method, body: readForm(new FormData(formElement)) });
      onDone();
      toast.add({ title: "Categoria salva.", type: "success" });
      load();
    } catch (err) {
      fail(err);
    }
  }

  async function setActive(category: Category, isActive: boolean) {
    clearError();
    try {
      await api(`${base}/${category.id}`, { method: "PATCH", body: { is_active: isActive } });
      load();
    } catch (err) {
      report(err);
    }
  }

  async function remove(category: Category) {
    clearError();
    try {
      await api(`${base}/${category.id}`, { method: "DELETE" });
      toast.add({ title: "Categoria excluída.", type: "success" });
      load();
    } catch (err) {
      report(err);
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Categorias</h1>
      <FormError message={error} kind={kind} />

      <NewItemCard title="Nova categoria" forceOpen={categories?.length === 0}>
        <CategoryForm
          fields={editingId ? {} : fields}
          submitLabel="Criar categoria"
          onSubmit={(event) => {
            const formElement = event.currentTarget;
            void save(event, { path: base, method: "POST" }, () => formElement.reset());
          }}
        />
      </NewItemCard>

      {categories === null ? (
        error ? null : <ListSkeleton />
      ) : categories.length === 0 ? (
        <EmptyList>Nenhuma categoria cadastrada.</EmptyList>
      ) : (
        categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {category.name}
                <Badge variant={category.is_active ? "secondary" : "outline"}>
                  {category.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {editingId === category.id ? (
                <CategoryForm
                  category={category}
                  fields={fields}
                  submitLabel="Salvar"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(event) =>
                    void save(event, { path: `${base}/${category.id}`, method: "PATCH" }, () =>
                      setEditingId(null),
                    )
                  }
                />
              ) : (
                <>
                  {category.description ? (
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Ordem: {category.sort_order}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFields({});
                        setEditingId(category.id);
                      }}
                    >
                      Editar
                    </Button>
                    {isOwner ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`active-${category.id}`}
                            checked={category.is_active}
                            onCheckedChange={(checked) => setActive(category, checked)}
                          />
                          <Label htmlFor={`active-${category.id}`}>Ativa</Label>
                        </div>
                        <ConfirmDelete
                          title={`Excluir a categoria "${category.name}"?`}
                          description="Só é possível excluir categorias sem produtos."
                          onConfirm={() => remove(category)}
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
