"use client";

import { PhoneField } from "@/components/phone-field";
import { normalizePhone } from "@/lib/phone";
import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { toast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/image-upload";
import { useSession } from "@/components/session-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type RestaurantData } from "@/lib/api";
import { restaurantMenuUrl } from "@/lib/public-url";

const OPTIONS = [
  { key: "accepts_dine_in", label: "Consumo no local", group: "modes" },
  { key: "accepts_pickup", label: "Retirada no balcão", group: "modes" },
  { key: "accepts_cash", label: "Dinheiro", group: "payments" },
  { key: "accepts_card", label: "Cartão", group: "payments" },
  { key: "accepts_pix", label: "Pix", group: "payments" },
] as const;

type OptionKey = (typeof OPTIONS)[number]["key"];

export default function SettingsPage() {
  usePageTitle("Configurações");
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const isOwner = restaurants.find((r) => r.id === restaurantId)?.role === "owner";

  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<OptionKey, boolean> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [restaurantId, reloadKey]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileError(null);
    setProfileFields({});
    try {
      const { data } = await api<{ data: RestaurantData }>(`/tenant/${restaurantId}/restaurant`, {
        method: "PATCH",
        body: {
          name: form.get("name"),
          description: form.get("description") || null,
          phone: normalizePhone(String(form.get("phone") ?? "")) || null,
        },
      });
      setRestaurant(data);
      toast.add({ title: "Dados salvos.", type: "success" });
    } catch (err) {
      setProfileFields(fieldErrors(err));
      setProfileError(errorMessage(err));
    }
  }

  async function saveSettings() {
    setSettingsError(null);
    try {
      await api(`/tenant/${restaurantId}/restaurant/settings`, {
        method: "PATCH",
        body: options,
      });
      toast.add({ title: "Configurações salvas.", type: "success" });
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

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MB.</p>
            <ImageUpload
              label="Logo do restaurante"
              imageUrl={restaurant.logo_url}
              uploadPath={`/tenant/${restaurantId}/restaurant/logo`}
              onChanged={() => setReloadKey((key) => key + 1)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Dados do restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid max-w-2xl gap-4">
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
            <PhoneField
              name="phone"
              label="Telefone"
              defaultValue={restaurant.phone ?? ""}
              error={profileFields.phone}
              disabled={!isOwner}
            />
            <div className="grid gap-1 text-sm">
              <p className="text-muted-foreground">Link público do cardápio (alterado só pela plataforma):</p>
              <a
                href={restaurantMenuUrl(restaurant.slug)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-6 items-center break-all font-medium underline underline-offset-4"
              >
                {restaurantMenuUrl(restaurant.slug)}
              </a>
              <p className="text-muted-foreground">
                {isOwner ? (
                  <>
                    O QR Code do restaurante está na página{" "}
                    <Link href={`/painel/${restaurantId}/mesas`} className="underline underline-offset-4">
                      QR Codes
                    </Link>
                    .
                  </>
                ) : (
                  "O QR Code do restaurante fica com o dono, na página QR Codes."
                )}
              </p>
            </div>
            <FormError message={profileError} />
            {isOwner ? <Button type="submit" size="lg" className="w-full sm:w-auto sm:justify-self-start">Salvar dados</Button> : null}
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
            <Button type="button" size="lg" className="w-full sm:w-auto sm:justify-self-start" onClick={saveSettings}>
              Salvar configurações
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
