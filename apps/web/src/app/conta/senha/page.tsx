"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api, type Me } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setFields({});

    if (form.get("new_password") !== form.get("confirmation")) {
      setFields({ confirmation: "A confirmação não coincide com a nova senha." });
      return;
    }

    setBusy(true);
    try {
      await api("/auth/password", {
        method: "PATCH",
        body: {
          current_password: form.get("current_password"),
          new_password: form.get("new_password"),
        },
      });
      // Depois da troca a senha temporária deixa de bloquear: segue para a área do perfil.
      const { data } = await api<{ data: Me }>("/auth/me");
      if (data.user.is_platform_admin) router.replace("/plataforma/restaurantes");
      else router.replace("/painel");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/entrar");
        return;
      }
      setFields(fieldErrors(err));
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field
              name="current_password"
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              error={fields.current_password}
              required
            />
            <Field
              name="new_password"
              label="Nova senha (10 a 128 caracteres)"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              error={fields.new_password}
              required
            />
            <Field
              name="confirmation"
              label="Confirme a nova senha"
              type="password"
              autoComplete="new-password"
              error={fields.confirmation}
              required
            />
            <FormError message={error} />
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
