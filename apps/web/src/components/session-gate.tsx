"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api, type Me } from "@/lib/api";

const SessionContext = createContext<Me | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession fora do SessionGate");
  return session;
}

// Consulta /auth/me uma única vez ao abrir a área (sem polling: cada requisição
// autenticada renova a inatividade da sessão, ADR 0002). Redireciona quando não há
// sessão, quando a senha temporária precisa ser trocada ou quando o perfil não pertence à área.
export function SessionGate({
  area,
  children,
}: {
  area: "plataforma" | "painel";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Me }>("/auth/me")
      .then(({ data }) => {
        const isAdmin = data.user.is_platform_admin;
        if (area === "plataforma" && !isAdmin) router.replace("/painel");
        else if (area === "painel" && isAdmin) router.replace("/plataforma/restaurantes");
        else setSession(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/entrar");
        else if (err instanceof ApiError && err.code === "PASSWORD_CHANGE_REQUIRED")
          router.replace("/conta/senha");
        else setError("Não foi possível carregar sua sessão. Tente novamente.");
      });
  }, [area, router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/entrar");
  }

  if (error) return <p className="p-6 text-destructive">{error}</p>;
  if (!session) return <p className="p-6 text-muted-foreground">Carregando…</p>;

  return (
    <SessionContext.Provider value={session}>
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <span className="font-semibold">Cardápio Digital</span>
          {area === "plataforma" ? (
            <Link href="/plataforma/restaurantes">Restaurantes</Link>
          ) : (
            <Link href="/painel">Meus restaurantes</Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{session.user.name}</span>
          <Link href="/conta/senha" className="underline">
            Trocar senha
          </Link>
          <Button variant="outline" size="sm" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
    </SessionContext.Provider>
  );
}
