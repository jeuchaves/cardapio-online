"use client";

import Link from "next/link";
import { useSession } from "@/components/session-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PainelPage() {
  const { restaurants } = useSession();

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Meus restaurantes</h1>
      {restaurants.length === 0 ? (
        <p className="text-muted-foreground">Você não tem vínculo ativo com nenhum restaurante.</p>
      ) : (
        restaurants.map((restaurant) => (
          <Card key={restaurant.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {restaurant.name}
                <Badge variant="secondary">{restaurant.role === "owner" ? "Dono" : "Equipe"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm underline">
              <Link href={`/painel/${restaurant.id}/categorias`}>Categorias</Link>
              <Link href={`/painel/${restaurant.id}/produtos`}>Produtos</Link>
              <Link href={`/painel/${restaurant.id}/adicionais`}>Adicionais</Link>
              <Link href={`/painel/${restaurant.id}/configuracoes`}>Configurações</Link>
              {restaurant.role === "owner" ? (
                <Link href={`/painel/${restaurant.id}/equipe`}>Equipe</Link>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
