"use client";

import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { TemporaryPassword } from "@/components/temporary-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";

type Created = {
  restaurant: { id: string; name: string };
  owner: { email: string; temporary_password?: string };
};

export default function NewRestaurantPage() {
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [needsLinkConfirmation, setNeedsLinkConfirmation] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [showPassword, setShowPassword] = useState(true);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setFields({});
    try {
      const { data } = await api<{ data: Created }>("/platform/restaurants", {
        method: "POST",
        body: {
          name: form.get("name"),
          slug: form.get("slug"),
          description: form.get("description") || undefined,
          phone: form.get("phone") || undefined,
          owner: { name: form.get("owner_name"), email: form.get("owner_email") },
          confirm_link_existing_user: form.get("confirm_link") === "on" || undefined,
        },
      });
      setCreated(data);
    } catch (err) {
      setNeedsLinkConfirmation(err instanceof ApiError && err.code === "EMAIL_TAKEN");
      const details = fieldErrors(err);
      setFields({
        slug: details.slug ?? (err instanceof ApiError && err.code === "SLUG_TAKEN" ? err.message : ""),
        ...details,
      });
      setError(errorMessage(err));
    }
  }

  if (created) {
    return (
      <div className="grid gap-4">
        <h1 className="text-xl font-semibold">Restaurante cadastrado</h1>
        <p>
          <strong>{created.restaurant.name}</strong> foi criado.
          {created.owner.temporary_password
            ? " Entregue a senha temporária abaixo ao dono."
            : " O usuário já existente foi vinculado como dono, sem alterar a senha dele."}
        </p>
        {created.owner.temporary_password && showPassword ? (
          <TemporaryPassword
            title={`Senha temporária de ${created.owner.email}`}
            password={created.owner.temporary_password}
            onClose={() => setShowPassword(false)}
          />
        ) : null}
        <Link href={`/plataforma/restaurantes/${created.restaurant.id}`} className="underline">
          Abrir restaurante
        </Link>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo restaurante</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field name="name" label="Nome" maxLength={120} error={fields.name} required />
          <Field
            name="slug"
            label="Slug (endereço público: /r/slug)"
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Letras minúsculas, números e hífens"
            error={fields.slug}
            required
          />
          <Field name="description" label="Descrição" maxLength={1000} error={fields.description} />
          <Field name="phone" label="Telefone" maxLength={20} error={fields.phone} />
          <h2 className="mt-2 font-medium">Dono do restaurante</h2>
          <Field
            name="owner_name"
            label="Nome do dono"
            maxLength={120}
            error={fields["owner.name"]}
            required
          />
          <Field
            name="owner_email"
            label="E-mail do dono"
            type="email"
            maxLength={254}
            error={fields["owner.email"]}
            required
          />
          {needsLinkConfirmation ? (
            <div className="flex items-start gap-2">
              <input id="confirm_link" name="confirm_link" type="checkbox" className="mt-1" />
              <Label htmlFor="confirm_link">
                Este e-mail já tem cadastro. Vincular o usuário existente como dono (a senha e os
                dados dele não são alterados).
              </Label>
            </div>
          ) : null}
          <FormError message={error} />
          <Button type="submit">Cadastrar restaurante</Button>
        </form>
      </CardContent>
    </Card>
  );
}
