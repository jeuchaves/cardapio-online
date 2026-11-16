"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/api";
import { MAX_QUANTITY, useCart } from "@/lib/cart";
import type { PublicProduct } from "@/lib/public-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Cada produto é um botão que abre o detalhe: adicionais opcionais, quantidade e o botão de
// adicionar ao carrinho. O preço exibido é o do cardápio; o total só existe na cotação da API.
export function PublicProductCard({ product }: { product: PublicProduct }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected([]);
      setQuantity(1);
      setError(null);
    }
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  }

  function addToCart() {
    const result = cart.add({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      addons: product.addons
        .filter((addon) => selected.includes(addon.id))
        .map((addon) => ({ id: addon.id, name: addon.name, price: addon.price })),
      quantity,
    });
    if (result.ok) setOpen(false);
    else setError(result.reason);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
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
              Adicionais (opcionais)
            </h3>
            <ul className="grid gap-2">
              {product.addons.map((addon) => (
                <li key={addon.id}>
                  <label
                    htmlFor={`addon-${product.id}-${addon.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-2 text-sm"
                  >
                    <Checkbox
                      id={`addon-${product.id}-${addon.id}`}
                      checked={selected.includes(addon.id)}
                      onCheckedChange={(checked) => toggle(addon.id, checked === true)}
                    />
                    <span className="grid min-w-0 flex-1">
                      <span>{addon.name}</span>
                      {addon.description && (
                        <span className="text-muted-foreground">{addon.description}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium">+ {formatPrice(addon.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium" id={`qty-${product.id}`}>
            Quantidade
          </span>
          <div className="flex items-center gap-2" role="group" aria-labelledby={`qty-${product.id}`}>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Diminuir quantidade"
              disabled={quantity <= 1}
              onClick={() => setQuantity((current) => current - 1)}
            >
              <Minus />
            </Button>
            <output className="min-w-6 text-center font-medium" aria-live="polite">
              {quantity}
            </output>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Aumentar quantidade"
              disabled={quantity >= MAX_QUANTITY}
              onClick={() => setQuantity((current) => current + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="button" size="lg" onClick={addToCart}>
          Adicionar ao carrinho
        </Button>
      </DialogContent>
    </Dialog>
  );
}
