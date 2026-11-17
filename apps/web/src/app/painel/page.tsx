"use client";

import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";

export default function PainelPage() {
  usePageTitle("Meus restaurantes");
  const { restaurants } = useSession();

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Meus restaurantes</h1>
      {restaurants.length === 0 ? (
        <p className="text-muted-foreground">Você não tem vínculo ativo com nenhum restaurante.</p>
      ) : (
        <ul className="grid gap-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <Link
                href={`/painel/${restaurant.id}/pedidos`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-border transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="grid min-w-0 gap-1">
                  <span className="truncate font-medium">{restaurant.name}</span>
                  <span>
                    <Badge variant="secondary">{restaurant.role === "owner" ? "Dono" : "Equipe"}</Badge>
                  </span>
                </span>
                <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
