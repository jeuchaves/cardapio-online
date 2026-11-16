"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "@/components/session-gate";

// Navegação entre as áreas do restaurante. Equipe é só do dono; o backend também recusa o staff.
export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const restaurant = restaurants.find((r) => r.id === restaurantId);

  return (
    <div className="grid gap-4">
      <nav className="flex flex-wrap gap-4 border-b pb-2 text-sm">
        <Link href="/painel" className="text-muted-foreground">
          ← {restaurant?.name ?? "Restaurantes"}
        </Link>
        <Link href={`/painel/${restaurantId}/pedidos`}>Pedidos</Link>
        <Link href={`/painel/${restaurantId}/categorias`}>Categorias</Link>
        <Link href={`/painel/${restaurantId}/produtos`}>Produtos</Link>
        <Link href={`/painel/${restaurantId}/adicionais`}>Adicionais</Link>
        <Link href={`/painel/${restaurantId}/configuracoes`}>Configurações</Link>
        {restaurant?.role === "owner" ? (
          <>
            <Link href={`/painel/${restaurantId}/mesas`}>QR Codes</Link>
            <Link href={`/painel/${restaurantId}/equipe`}>Equipe</Link>
          </>
        ) : null}
      </nav>
      {children}
    </div>
  );
}
