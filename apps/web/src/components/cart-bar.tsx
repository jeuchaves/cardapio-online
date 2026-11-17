"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { buttonVariants } from "@/components/ui/button";

// Atalho fixo para o carrinho; só aparece quando há itens.
export function CartBar({ slug }: { slug: string }) {
  const { count } = useCart();
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div className="mx-auto max-w-[calc(var(--container-2xl)-2rem)]">
        <Link
          href={`/r/${encodeURIComponent(slug)}/carrinho`}
          className={`${buttonVariants({ size: "lg" })} pointer-events-auto w-full shadow-lg`}
        >
          <ShoppingCart />
          Ver carrinho ({count})
        </Link>
      </div>
    </div>
  );
}
