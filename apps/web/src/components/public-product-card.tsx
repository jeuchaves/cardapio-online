"use client";

import { useState } from "react";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/api";
import { MAX_QUANTITY, useCart } from "@/lib/cart";
import type { PublicProduct } from "@/lib/public-menu";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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
      imageUrl: product.image_url,
      addons: product.addons
        .filter((addon) => selected.includes(addon.id))
        .map((addon) => ({ id: addon.id, name: addon.name, price: addon.price })),
      quantity,
    });
    if (result.ok) setOpen(false);
    else setError(result.reason);
  }

  // Produto sem adicionais entra no carrinho com um toque (quantidade 1); com adicionais, só pelo detalhe
  function quickAdd() {
    const result = cart.add({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      imageUrl: product.image_url,
      addons: [],
      quantity: 1,
    });
    toast.add(
      result.ok
        ? { title: `${product.name} adicionado ao carrinho.`, type: "success" }
        : { title: result.reason, type: "error" },
    );
  }

  const nameId = `produto-${product.id}`;

  const descId = `${nameId}-descricao`;
  const hasAddons = product.addons.length > 0;

  // Linha de menu: texto à esquerda, e à direita a foto com a ação logo abaixo, sempre na mesma
  // borda. O gatilho do detalhe cobre a linha inteira (alvo de toque grande) sem conter a ação
  // rápida, que fica acima dele: botão dentro de botão não é válido.
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <div className="relative flex gap-3 px-3 py-3 transition-colors hover:bg-muted/50">
        <DialogTrigger
          data-product-trigger
          aria-labelledby={nameId}
          aria-describedby={product.description ? descId : undefined}
          className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-1">
          <span id={nameId} className="text-base leading-snug font-medium [overflow-wrap:anywhere]">
            {product.name}
          </span>
          {product.description && (
            <span id={descId} className="line-clamp-2 text-base leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              {product.description}
            </span>
          )}
          <span className="mt-1 font-semibold tabular-nums">{formatPrice(product.price)}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt=""
              width={80}
              height={80}
              loading="lazy"
              className="size-20 rounded-lg object-cover"
            />
          )}
          {hasAddons ? (
            <span aria-hidden="true" className="pointer-events-none flex h-11 items-center gap-0.5 text-sm font-medium text-primary">
              Opções
              <ChevronRight className="size-4" />
            </span>
          ) : (
            <Button
              type="button"
              size="icon-lg"
              className="relative rounded-full"
              aria-label="Adicionar ao carrinho"
              aria-describedby={nameId}
              onClick={quickAdd}
            >
              <Plus />
            </Button>
          )}
        </div>
      </div>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            width={640}
            height={360}
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
                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
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
