"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { useSession } from "@/components/session-gate";
import { TemporaryPassword } from "@/components/temporary-password";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type StaffMember } from "@/lib/api";

type Revealed = { email: string; password: string };

export default function StaffPage() {
  usePageTitle("Equipe");
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const isOwner = restaurants.find((r) => r.id === restaurantId)?.role === "owner";

  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    if (!isOwner) return;
    api<{ data: StaffMember[] }>(`/tenant/${restaurantId}/staff`)
      .then(({ data }) => setMembers(data))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [isOwner, restaurantId, reloadKey]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    setFields({});
    try {
      const { data } = await api<{ data: { email: string; temporary_password: string } }>(
        `/tenant/${restaurantId}/staff`,
        { method: "POST", body: { name: form.get("name"), email: form.get("email") } },
      );
      setRevealed({ email: data.email, password: data.temporary_password });
      formElement.reset();
      load();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  }

  async function toggle(member: StaffMember) {
    setError(null);
    try {
      await api(`/tenant/${restaurantId}/staff/${member.id}`, {
        method: "PATCH",
        body: { is_active: !member.is_active },
      });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resetPassword(member: StaffMember) {
    if (!window.confirm(`Gerar nova senha temporária para ${member.name}? As sessões dele serão encerradas.`))
      return;
    setError(null);
    try {
      const { data } = await api<{ data: { email: string; temporary_password: string } }>(
        `/tenant/${restaurantId}/staff/${member.id}/reset-password`,
        { method: "POST" },
      );
      setRevealed({ email: data.email, password: data.temporary_password });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!isOwner) {
    return <p className="text-muted-foreground">Somente o dono do restaurante gerencia a equipe.</p>;
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Equipe</h1>
      {revealed ? (
        <TemporaryPassword
          title={`Senha temporária de ${revealed.email}`}
          password={revealed.password}
          onClose={() => setRevealed(null)}
        />
      ) : null}
      <FormError message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Novo atendente</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field name="name" label="Nome" maxLength={120} error={fields.name} required />
            <Field
              name="email"
              label="E-mail"
              type="email"
              maxLength={254}
              error={fields.email}
              required
            />
            <Button type="submit" size="lg" className="w-full sm:col-span-2 sm:w-auto sm:justify-self-start">
              Criar atendente
            </Button>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(members ?? []).map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                {member.name}
                <div className="text-xs text-muted-foreground">{member.email}</div>
              </TableCell>
              <TableCell>{member.role === "owner" ? "Dono" : "Equipe"}</TableCell>
              <TableCell>
                <Badge variant={member.is_active ? "secondary" : "outline"}>
                  {member.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {member.role === "staff" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => toggle(member)}>
                      {member.is_active ? "Desativar" : "Reativar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resetPassword(member)}>
                      Nova senha
                    </Button>
                  </>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
