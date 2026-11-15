"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { useSession } from "@/components/session-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type RestaurantData } from "@/lib/api";

const OPTIONS = [
  { key: "accepts_dine_in", label: "Consumo no local", group: "modes" },
  { key: "accepts_pickup", label: "Retirada no balcão", group: "modes" },
  { key: "accepts_cash", label: "Dinheiro", group: "payments" },
  { key: "accepts_card", label: "Cartão", group: "payments" },
  { key: "accepts_pix", label: "Pix", group: "payments" },
] as const;

type OptionKey = (typeof OPTIONS)[number]["key"];

export default function SettingsPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const isOwner = restaurants.find((r) => r.id === restaurantId)?.role === "owner";

  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<OptionKey, boolean> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: RestaurantData }>(`/tenant/${restaurantId}/restaurant`)
      .then(({ data }) => {
        setRestaurant(data);
        setOptions({
          accepts_dine_in: data.accepts_dine_in,
          accepts_pickup: data.accepts_pickup,
          accepts_cash: data.accepts_cash,
          accepts_card: data.accepts_card,
          accepts_pix: data.accepts_pix,
        });
      })
      .catch((err: unknown) => setLoadError(errorMessage(err)));
  }, [restaurantId]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileError(null);
    setProfileFields({});
    setMessage(null);
    try {
      const { data } = await api<{ data: RestaurantData }>(`/tenant/${restaurantId}/restaurant`, {
        method: "PATCH",
        body: {
          name: form.get("name"),
          description: form.get("description") || null,
          phone: form.get("phone") || null,
        },
      });
      setRestaurant(data);
      setMessage("Dados salvos.");
    } catch (err) {
      setProfileFields(fieldErrors(err));
      setProfileError(errorMessage(err));
    }
  }

  async function saveSettings() {
    setSettingsError(null);
    setMessage(null);
    try {
      await api(`/tenant/${restaurantId}/restaurant/settings`, {
        method: "PATCH",
        body: options,
      });
      setMessage("Configurações salvas.");
    } catch (err) {
      setSettingsError(errorMessage(err));
    }
  }

  if (loadError) return <p className="text-destructive">{loadError}</p>;
  if (!restaurant || !options) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">{restaurant.name}</h1>
      {isOwner ? null : (
        <p className="text-sm text-muted-foreground">
          Somente o dono do restaurante pode alterar estas informações.
        </p>
      )}
      {message ? <p role="status">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Dados do restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4">
            <Field
              name="name"
              label="Nome"
              defaultValue={restaurant.name}
              maxLength={120}
              error={profileFields.name}
              disabled={!isOwner}
              required
            />
            <Field
              name="description"
              label="Descrição"
              defaultValue={restaurant.description ?? ""}
              maxLength={1000}
              error={profileFields.description}
              disabled={!isOwner}
            />
            <Field
              name="phone"
              label="Telefone"
              defaultValue={restaurant.phone ?? ""}
              maxLength={20}
              error={profileFields.phone}
              disabled={!isOwner}
            />
            <p className="text-sm text-muted-foreground">
              Endereço público: <code>/r/{restaurant.slug}</code> (alterado só pela plataforma).
            </p>
            <FormError message={profileError} />
            {isOwner ? <Button type="submit">Salvar dados</Button> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atendimento e pagamento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(["modes", "payments"] as const).map((group) => (
            <fieldset key={group} className="grid gap-3">
              <legend className="mb-1 text-sm font-medium">
                {group === "modes" ? "Modalidades (ao menos uma)" : "Pagamento (ao menos um)"}
              </legend>
              {OPTIONS.filter((option) => option.group === group).map((option) => (
                <div key={option.key} className="flex items-center gap-3">
                  <Switch
                    id={option.key}
                    checked={options[option.key]}
                    disabled={!isOwner}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, [option.key]: checked })
                    }
                  />
                  <Label htmlFor={option.key}>{option.label}</Label>
                </div>
              ))}
            </fieldset>
          ))}
          <FormError message={settingsError} />
          {isOwner ? (
            <Button type="button" onClick={saveSettings}>
              Salvar configurações
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
