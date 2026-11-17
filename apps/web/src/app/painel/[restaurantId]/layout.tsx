"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { useSession } from "@/components/session-gate";
import { cn } from "@/lib/utils";

// Navegação entre as áreas do restaurante. Equipe é só do dono; o backend também recusa o staff.
// Em telas estreitas os itens ficam num menu recolhível (nenhum item depende de rolagem lateral);
// a partir de 640 px aparecem em linha, com quebra se for preciso.
export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const pathname = usePathname();
  const { restaurants } = useSession();
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const base = `/painel/${restaurantId}`;
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const items = [
    { href: `${base}/pedidos`, label: "Pedidos" },
    { href: `${base}/categorias`, label: "Categorias" },
    { href: `${base}/produtos`, label: "Produtos" },
    { href: `${base}/adicionais`, label: "Adicionais" },
    { href: `${base}/configuracoes`, label: "Configurações" },
    ...(restaurant?.role === "owner"
      ? [
          { href: `${base}/mesas`, label: "QR Codes" },
          { href: `${base}/equipe`, label: "Equipe" },
        ]
      : []),
  ];
  const current = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm print:hidden">
        {restaurants.length > 1 ? (
          <>
            <Link
              href="/painel"
              className="inline-flex min-h-11 shrink-0 items-center text-muted-foreground hover:text-foreground"
            >
              ← Restaurantes
            </Link>
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
          </>
        ) : null}
        <span className="truncate font-medium">{restaurant?.name ?? "Restaurante"}</span>
      </div>
      <nav
        aria-label="Áreas do restaurante"
        className="border-b pb-2 print:hidden"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            toggleRef.current?.focus();
          }
        }}
      >
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls="areas-do-restaurante"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-sm font-medium sm:hidden"
        >
          <span>
            <span className="font-normal text-muted-foreground">Área: </span>
            {current?.label ?? "Menu"}
          </span>
          <ChevronDownIcon aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        <ul
          id="areas-do-restaurante"
          onClick={() => setOpen(false)}
          className={cn("mt-1 gap-1 sm:mt-0 sm:flex sm:flex-wrap", open ? "grid" : "hidden")}
        >
          {items.map((item) => (
            <li key={item.href} className="grid sm:block">
              <NavLink href={item.href}>{item.label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
