"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/field";
import { FormError, useFormFeedback } from "@/components/form-error";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type Me } from "@/lib/api";

export default function LoginPage() {
  usePageTitle("Entrar");
  const router = useRouter();
  const { error, kind, fields, reset, fail, invalid } = useFormFeedback();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset();
    if (invalid(event.currentTarget)) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { data } = await api<{ data: Me }>("/auth/login", {
        method: "POST",
        body: { email: form.get("email"), password: form.get("password") },
      });
      if (data.user.must_change_password) router.replace("/conta/senha");
      else if (data.user.is_platform_admin) router.replace("/plataforma/restaurantes");
      else if (data.restaurants.length === 1)
        router.replace(`/painel/${data.restaurants[0].id}/pedidos`);
      else router.replace("/painel");
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  }

  return (
    <main id="conteudo" tabIndex={-1} className="flex flex-1 items-center justify-center p-4 outline-none">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1">Entrar</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            <Field name="email" label="E-mail" type="email" autoComplete="username" required error={fields.email} />
            <PasswordField
              name="password"
              label="Senha"
              autoComplete="current-password"
              required
              error={fields.password}
            />
            <FormError message={error} kind={kind} />
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
