"use client";

import { formatPrice } from "@/lib/api";
import type { PublicProduct } from "@/lib/public-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Cada produto é um botão que abre o detalhe com os adicionais. Ainda sem carrinho.
export function PublicProductCard({ product }: { product: PublicProduct }) {
  return (
    <Dialog>
      <DialogTrigger
        className="flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="font-medium">{product.name}</span>
          {product.description && (
            <span className="line-clamp-2 text-sm text-muted-foreground">{product.description}</span>
          )}
          <span className="mt-1 font-semibold">{formatPrice(product.price)}</span>
        </span>
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            loading="lazy"
            className="size-24 shrink-0 rounded-lg object-cover"
          />
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{product.description ?? "Sem descrição."}</DialogDescription>
        </DialogHeader>
        <p className="text-lg font-semibold">{formatPrice(product.price)}</p>
        {product.addons.length > 0 && (
          <section aria-labelledby={`addons-${product.id}`} className="grid gap-2">
            <h3 id={`addons-${product.id}`} className="text-sm font-medium">
              Adicionais
            </h3>
            <ul className="grid gap-2">
              {product.addons.map((addon) => (
                <li
                  key={addon.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-2 text-sm"
                >
                  <span className="grid min-w-0">
                    <span>{addon.name}</span>
                    {addon.description && (
                      <span className="text-muted-foreground">{addon.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium">+ {formatPrice(addon.price)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
