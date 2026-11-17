"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { NavLink } from "@/components/nav-link";
import { useSession } from "@/components/session-gate";

// Navegação entre as áreas do restaurante. Equipe é só do dono; o backend também recusa o staff.
export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useSession();
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const base = `/painel/${restaurantId}`;

  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Link
          href="/painel"
          className="inline-flex min-h-11 shrink-0 items-center text-muted-foreground hover:text-foreground"
        >
          ← Restaurantes
        </Link>
        <span aria-hidden="true" className="text-muted-foreground">
          /
        </span>
        <span className="truncate font-medium">{restaurant?.name ?? "Restaurante"}</span>
      </div>
      <nav aria-label="Áreas do restaurante" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 pb-2">
        <NavLink href={`${base}/pedidos`}>Pedidos</NavLink>
        <NavLink href={`${base}/categorias`}>Categorias</NavLink>
        <NavLink href={`${base}/produtos`}>Produtos</NavLink>
        <NavLink href={`${base}/adicionais`}>Adicionais</NavLink>
        <NavLink href={`${base}/configuracoes`}>Configurações</NavLink>
        {restaurant?.role === "owner" ? (
          <>
            <NavLink href={`${base}/mesas`}>QR Codes</NavLink>
            <NavLink href={`${base}/equipe`}>Equipe</NavLink>
          </>
        ) : null}
      </nav>
      {children}
    </div>
  );
}
