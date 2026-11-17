"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormError, errorMessage, fieldErrors, focusFirstError } from "@/components/form-error";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api, type Me } from "@/lib/api";

export default function ChangePasswordPage() {
  usePageTitle("Trocar senha");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (error || Object.keys(fields).length > 0) focusFirstError(formRef.current);
  }, [error, fields]);

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
    <main id="conteudo" tabIndex={-1} className="flex flex-1 items-center justify-center p-4 outline-none">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1">Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
            <PasswordField
              name="current_password"
              label="Senha atual"
              autoComplete="current-password"
              error={fields.current_password}
              required
            />
            <PasswordField
              name="new_password"
              label="Nova senha (10 a 128 caracteres)"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              error={fields.new_password}
              required
            />
            <PasswordField
              name="confirmation"
              label="Confirme a nova senha"
              autoComplete="new-password"
              error={fields.confirmation}
              required
            />
            <FormError message={error} />
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
