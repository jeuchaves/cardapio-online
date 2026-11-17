"use client";

import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageLoading } from "@/components/list-states";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PainelPage() {
  usePageTitle("Meus restaurantes");
  const { restaurants } = useSession();
  const router = useRouter();
  const single = restaurants.length === 1 ? restaurants[0] : null;

  useEffect(() => {
    if (single) router.replace(`/painel/${single.id}/pedidos`);
  }, [single, router]);

  if (single) return <PageLoading label="Abrindo o painel…" />;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Meus restaurantes</h1>
      {restaurants.length === 0 ? (
        <p className="text-muted-foreground">Você não tem vínculo ativo com nenhum restaurante.</p>
      ) : (
        <ul className="grid gap-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id} className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{restaurant.name}</span>
                <Badge variant="secondary">{restaurant.role === "owner" ? "Dono" : "Equipe"}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/painel/${restaurant.id}/pedidos`} className={buttonVariants({ size: "lg" })}>
                  Pedidos
                </Link>
                {restaurant.role === "owner" ? (
                  <Link
                    href={`/painel/${restaurant.id}/mesas`}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                  >
                    QR Codes
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
