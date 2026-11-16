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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 p-4">
      <Link
        href={`/r/${encodeURIComponent(slug)}/carrinho`}
        className={`${buttonVariants({ size: "lg" })} pointer-events-auto mx-auto flex h-11 w-full max-w-2xl shadow-lg`}
      >
        <ShoppingCart />
        Ver carrinho ({count})
      </Link>
    </div>
  );
}
