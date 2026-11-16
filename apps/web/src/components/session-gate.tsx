"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { PageLoading, ErrorState } from "@/components/list-states";
import { NavLink } from "@/components/nav-link";
import { Button, buttonVariants } from "@/components/ui/button";
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

  if (error) {
    return (
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col justify-center outline-none">
        <ErrorState
          title="Sessão indisponível"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </main>
    );
  }
  if (!session) {
    return (
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 outline-none">
        <PageLoading label="Carregando sua sessão…" />
      </main>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-1.5">
          <span className="font-semibold">Cardápio Digital</span>
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden max-w-48 truncate text-muted-foreground md:inline">
              {session.user.name}
            </span>
            <Link href="/conta/senha" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Trocar senha
            </Link>
            <Button variant="outline" size="lg" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
        {area === "plataforma" ? (
          <nav aria-label="Plataforma" className="mx-auto flex w-full max-w-5xl gap-1 px-4 pb-1">
            <NavLink href="/plataforma/restaurantes">Restaurantes</NavLink>
          </nav>
        ) : null}
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 p-4 outline-none">
        {children}
      </main>
    </SessionContext.Provider>
  );
}
