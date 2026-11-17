"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/image-upload";
import { EmptyList, ListSkeleton } from "@/components/list-states";
import { NewItemCard } from "@/components/new-item-card";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, formatPrice, type Addon, type Category, type Product } from "@/lib/api";

const MAX_ADDONS = 10;
const ALL = "all";

type ProductList = { data: Product[]; meta: { page: number; per_page: number; total: number } };

function CategorySelect({
  categories,
  defaultValue,
  error,
}: {
  categories: Category[];
  defaultValue?: string;
  error?: string;
}) {
  const items = categories.map((category) => ({
    value: category.id,
    label: category.is_active ? category.name : `${category.name} (inativa)`,
  }));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="category_id">Categoria</Label>
      <Select name="category_id" defaultValue={defaultValue} items={items} required>
        <SelectTrigger id="category_id" className="w-full" aria-invalid={error ? true : undefined}>
          <SelectValue placeholder="Selecione…" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function ProductForm({
  product,
  categories,
  fields,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  product?: Product;
  categories: Category[];
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
        defaultValue={product?.name}
        maxLength={120}
        error={fields.name}
        required
      />
      <CategorySelect
        categories={categories}
        defaultValue={product?.category_id}
        error={fields.category_id}
      />
      <Field
        name="price"
        label="Preço (ex.: 12,50)"
        inputMode="decimal"
        defaultValue={product?.price.replace(".", ",")}
        maxLength={11}
        error={fields.price}
        required
      />
      <Field
        name="sort_order"
        label="Ordem (0 a 9999)"
        type="number"
        min={0}
        max={9999}
        step={1}
        defaultValue={product?.sort_order ?? 0}
        hint="Número menor aparece primeiro; com o mesmo número, vale a ordem alfabética."
        error={fields.sort_order}
      />
      <div className="sm:col-span-2">
        <Field
          name="description"
          label="Descrição"
          defaultValue={product?.description ?? ""}
          maxLength={1000}
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

// O preço segue como texto até a API (que valida e calcula); só a vírgula vira ponto.
// A ordem é um inteiro de exibição, não um valor monetário.
function readForm(form: FormData) {
  const sortOrder = String(form.get("sort_order") ?? "").trim();
  return {
    category_id: form.get("category_id"),
    name: form.get("name"),
    description: String(form.get("description") ?? "").trim() || null,
    price: String(form.get("price") ?? "").trim().replace(",", "."),
    ...(sortOrder !== "" && { sort_order: Number(sortOrder) }),
  };
}

function AddonPicker({
  product,
  addons,
  base,
  onDone,
  onSaved,
}: {
  product: Product;
  addons: Addon[];
  base: string;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(product.addons.map((addon) => addon.id));
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, checked: boolean) {
    setSelected(checked ? [...selected, id] : selected.filter((item) => item !== id));
  }

  async function save() {
    setError(null);
    try {
      await api(`${base}/${product.id}/addons`, { method: "PUT", body: { addon_ids: selected } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-3">
      {addons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cadastre adicionais na página Adicionais.</p>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">
            Adicionais do produto ({selected.length}/{MAX_ADDONS})
          </legend>
          {addons.map((addon) => (
            <div key={addon.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`addon-${product.id}-${addon.id}`}
                checked={selected.includes(addon.id)}
                disabled={!selected.includes(addon.id) && selected.length >= MAX_ADDONS}
                onCheckedChange={(checked) => toggle(addon.id, checked)}
              />
              <Label htmlFor={`addon-${product.id}-${addon.id}`}>
                {addon.name} · {formatPrice(addon.price)}
                {addon.is_available ? "" : " (indisponível)"}
              </Label>
            </div>
          ))}
        </fieldset>
      )}
      <FormError message={error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>
          Salvar adicionais
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  usePageTitle("Produtos");
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const isOwner = restaurants.find((r) => r.id === restaurantId)?.role === "owner";
  const base = `/tenant/${restaurantId}/products`;

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [products, setProducts] = useState<ProductList | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; mode: "edit" | "addons" } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    Promise.all([
      api<{ data: Category[] }>(`/tenant/${restaurantId}/categories`),
      api<{ data: Addon[] }>(`/tenant/${restaurantId}/addons`),
    ])
      .then(([categoryList, addonList]) => {
        setCategories(categoryList.data);
        setAddons(addonList.data);
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [restaurantId, reloadKey]);

  useEffect(() => {
    const query = new URLSearchParams({ page: String(page) });
    if (filter) query.set("category_id", filter);
    api<ProductList>(`${base}?${query}`)
      .then(setProducts)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [base, filter, page, reloadKey]);

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
      toast.add({ title: "Produto salvo.", type: "success" });
      load();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  }

  async function setAvailable(product: Product, isAvailable: boolean) {
    setError(null);
    try {
      await api(`${base}/${product.id}`, { method: "PATCH", body: { is_available: isAvailable } });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(product: Product) {
    setError(null);
    try {
      await api(`${base}/${product.id}`, { method: "DELETE" });
      toast.add({ title: "Produto excluído.", type: "success" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? "—";
  const total = products?.meta.total ?? 0;
  const perPage = products?.meta.per_page ?? 20;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  if (categories === null && !error) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Produtos</h1>
        <p className="text-sm text-muted-foreground">Imagens: JPEG, PNG ou WebP, até 5 MB.</p>
      </div>
      <FormError message={error} />

      <NewItemCard title="Novo produto" forceOpen={(products?.meta.total === 0 && !filter) || categories?.length === 0}>
        {categories && categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre ao menos uma categoria antes de criar produtos.
          </p>
        ) : (
          <ProductForm
            categories={categories ?? []}
            fields={editing ? {} : fields}
            submitLabel="Criar produto"
            onSubmit={(event) => {
              const formElement = event.currentTarget;
              void save(event, { path: base, method: "POST" }, () => formElement.reset());
            }}
          />
        )}
      </NewItemCard>

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="filter">Filtrar por categoria</Label>
        <Select
          value={filter || ALL}
          items={[{ value: ALL, label: "Todas" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          onValueChange={(value) => {
            setFilter(value === ALL || value === null ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger id="filter" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {(categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {products === null ? (
        error ? null : <ListSkeleton />
      ) : products.data.length === 0 ? (
        <EmptyList>Nenhum produto encontrado.</EmptyList>
      ) : (
        products.data.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>
                  {product.name} <span className="font-normal whitespace-nowrap">· {formatPrice(product.price)}</span>
                </span>
                <Badge variant={product.is_available ? "secondary" : "outline"}>
                  {product.is_available ? "Disponível" : "Indisponível"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {editing?.id === product.id && editing.mode === "edit" ? (
                <ProductForm
                  product={product}
                  categories={categories ?? []}
                  fields={fields}
                  submitLabel="Salvar"
                  onCancel={() => setEditing(null)}
                  onSubmit={(event) =>
                    void save(event, { path: `${base}/${product.id}`, method: "PATCH" }, () =>
                      setEditing(null),
                    )
                  }
                />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Categoria: {categoryName(product.category_id)} · Ordem: {product.sort_order}
                  </p>
                  {product.description ? (
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  ) : null}
                  <ImageUpload
                    label={`Imagem de ${product.name}`}
                    imageUrl={product.image_url}
                    uploadPath={`${base}/${product.id}/image`}
                    removePath={isOwner ? `${base}/${product.id}/image` : undefined}
                    onChanged={load}
                  />
                  {editing?.id === product.id && editing.mode === "addons" ? (
                    <AddonPicker
                      product={product}
                      addons={addons}
                      base={base}
                      onDone={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        toast.add({ title: "Adicionais do produto salvos.", type: "success" });
                        load();
                      }}
                    />
                  ) : (
                    <p className="text-sm">
                      Adicionais:{" "}
                      {product.addons.length === 0
                        ? "nenhum"
                        : product.addons
                            .map((addon) => `${addon.name}${addon.is_available ? "" : " (indisponível)"}`)
                            .join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFields({});
                        setEditing({ id: product.id, mode: "edit" });
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ id: product.id, mode: "addons" })}
                    >
                      Adicionais
                    </Button>
                    {isOwner ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`available-${product.id}`}
                            checked={product.is_available}
                            onCheckedChange={(checked) => setAvailable(product, checked)}
                          />
                          <Label htmlFor={`available-${product.id}`}>Disponível</Label>
                        </div>
                        <ConfirmDelete
                          title={`Excluir o produto "${product.name}"?`}
                          description="O produto e a imagem dele serão removidos. Pedidos antigos não são afetados."
                          onConfirm={() => remove(product)}
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

      {lastPage > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span>
            Página {page} de {lastPage}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= lastPage}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
