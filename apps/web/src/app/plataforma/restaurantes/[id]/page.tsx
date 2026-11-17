"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { TemporaryPassword } from "@/components/temporary-password";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api, type RestaurantData } from "@/lib/api";


export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  usePageTitle(restaurant ? restaurant.name : "Restaurante");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [slug, setSlug] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    api<{ data: RestaurantData }>(`/platform/restaurants/${id}`)
      .then(({ data }) => {
        setRestaurant(data);
        setSlug(data.slug);
      })
      .catch((err: unknown) => setLoadError(errorMessage(err)));
  }, [id, reloadKey]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setFields({});
    try {
      await api(`/platform/restaurants/${id}`, {
        method: "PATCH",
        body: {
          name: form.get("name"),
          slug: form.get("slug"),
          description: form.get("description") || null,
          phone: form.get("phone") || null,
          confirm_slug_change: form.get("confirm_slug_change") === "on" || undefined,
        },
      });
      toast.add({ title: "Dados salvos.", type: "success" });
      load();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  }

  async function setActive(isActive: boolean) {
    setError(null);
    try {
      await api(`/platform/restaurants/${id}/status`, {
        method: "PATCH",
        body: { is_active: isActive },
      });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resetOwner() {
    if (
      !window.confirm(
        "Gerar nova senha temporária para o dono? A senha vale em todos os restaurantes dele e as sessões dele serão encerradas.",
      )
    )
      return;
    setError(null);
    try {
      const { data } = await api<{ data: { temporary_password: string } }>(
        `/platform/restaurants/${id}/owner/reset-password`,
        { method: "POST" },
      );
      setRevealed(data.temporary_password);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loadError) return <p className="text-destructive">{loadError}</p>;
  if (!restaurant) return <p className="text-muted-foreground">Carregando…</p>;

  const slugChanged = slug !== restaurant.slug;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{restaurant.name}</h1>
        <Badge variant={restaurant.is_active ? "secondary" : "outline"}>
          {restaurant.is_active ? "Ativo" : "Inativo"}
        </Badge>
      </div>
      {revealed ? (
        <TemporaryPassword
          title="Nova senha temporária do dono"
          password={revealed}
          onClose={() => setRevealed(null)}
        />
      ) : null}
      <FormError message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid max-w-2xl gap-4" key={restaurant.slug + restaurant.name}>
            <Field name="name" label="Nome" defaultValue={restaurant.name} maxLength={120} error={fields.name} required />
            <Field
              name="slug"
              label="Slug"
              defaultValue={restaurant.slug}
              maxLength={60}
              error={fields.slug}
              onChange={(event) => setSlug(event.target.value)}
              required
            />
            {slugChanged ? (
              <div className="flex items-start gap-2">
                <Checkbox id="confirm_slug_change" name="confirm_slug_change" className="mt-1" />
                <Label htmlFor="confirm_slug_change">
                  Entendo que alterar o slug invalida links e QR Codes já impressos.
                </Label>
              </div>
            ) : null}
            <Field name="description" label="Descrição" defaultValue={restaurant.description ?? ""} maxLength={1000} error={fields.description} />
            <Field name="phone" label="Telefone" defaultValue={restaurant.phone ?? ""} maxLength={20} error={fields.phone} />
            <Button type="submit" size="lg" className="w-full sm:w-auto sm:justify-self-start">Salvar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Situação</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Restaurante inativo deixa de aparecer ao público; o painel continua acessível.
          </p>
          <Button variant="outline" onClick={() => setActive(!restaurant.is_active)}>
            {restaurant.is_active ? "Desativar" : "Ativar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dono</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Gera uma nova senha temporária (exibida uma única vez). Não há recuperação por e-mail.
          </p>
          <Button variant="outline" onClick={resetOwner}>
            Nova senha do dono
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
