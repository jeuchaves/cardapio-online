"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/api";
import { MAX_QUANTITY, useCart } from "@/lib/cart";
import {
  createOrder,
  quoteCart,
  unavailableLines,
  type OrderInput,
  type Quote,
} from "@/lib/public-order";
import type { PublicRestaurant } from "@/lib/public-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/field";
import { FormError, errorMessage, fieldErrors } from "@/components/form-error";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTableCheck } from "@/lib/use-table-check";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PageLoading } from "@/components/list-states";

type Mode = PublicRestaurant["fulfillment_modes"][number];
type Payment = PublicRestaurant["payment_methods"][number];

// Linha de escolha única. O rótulo não envolve o radio: o Base UI mantém um `input` oculto junto do
// controle, e dentro de um `label` o leitor de tela passaria a ver dois controles com o mesmo nome.
// O nome vem de `aria-labelledby`, e o clique no texto seleciona pela própria linha.
function ChoiceRow({
  id,
  value,
  disabled = false,
  onSelect,
  children,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <RadioGroupItem value={value} disabled={disabled} aria-labelledby={id} />
      <span id={id}>{children}</span>
    </div>
  );
}

const MODES: Record<Mode, string> = { dine_in: "Consumo no local", pickup: "Retirada" };
const PAYMENTS: Record<Payment, string> = { cash: "Dinheiro", card: "Cartão", pix: "Pix" };
const QUOTE_DELAY_MS = 300;

// Carrinho e checkout na mesma tela. Nenhum valor é calculado aqui: preços unitários vêm do
// cardápio, subtotais e total vêm da cotação da API (informativos) e o total final vem do pedido.
export function Checkout({ restaurant }: { restaurant: PublicRestaurant }) {
  const router = useRouter();
  const cart = useCart();
  const slug = restaurant.slug;
  const base = `/r/${encodeURIComponent(slug)}`;

  // A cotação só vale para o conteúdo do carrinho com o qual foi pedida
  const signature = JSON.stringify(cart.lines.map((line) => [line.key, line.quantity]));
  const [quoted, setQuoted] = useState<{ signature: string; quote: Quote } | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  // Chaves das linhas que a API disse estarem indisponíveis (ITEM_UNAVAILABLE)
  const [flagged, setFlagged] = useState<string[]>([]);

  useEffect(() => {
    if (!cart.ready || cart.lines.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      quoteCart(slug, cart.lines, controller.signal)
        .then((quote) => {
          setQuoted({ signature, quote });
          setQuoteFailed(false);
          setFlagged([]);
        })
        // Falha da cotação (rede, item indisponível, limite) não impede o envio do pedido
        .catch((caught) => {
          if (controller.signal.aborted) return;
          setQuoteFailed(true);
          const affected = unavailableLines(caught, cart.lines);
          if (affected) setFlagged(affected.map((line) => line.key));
        });
    }, QUOTE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `signature` resume o conteúdo relevante de cart.lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, slug, signature]);

  const quote = quoted && quoted.signature === signature ? quoted.quote : null;

  const modes = restaurant.fulfillment_modes;
  // A mesa guardada do QR Code é conferida na API antes do envio: mesa inexistente, desativada ou sem
  // consumo no local habilitado deixa de ser uma opção (a API também recusa ao criar o pedido)
  const tableCheck = useTableCheck(slug, cart.table, cart.ready);
  const tableInvalid = tableCheck.state === "invalid";
  const table = tableInvalid ? null : cart.table;
  // Consumo no local só é possível com o identificador da mesa vindo do QR Code
  const dineInAvailable = modes.includes("dine_in") && table !== null;
  const pickupAvailable = modes.includes("pickup");

  const [fulfillment, setFulfillment] = useState<Mode | null>(null);
  const [payment, setPayment] = useState<Payment | null>(restaurant.payment_methods[0] ?? null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mesmo payload reenviado reaproveita a chave; payload diferente gera uma nova tentativa
  const attempt = useRef<{ key: string; fingerprint: string } | null>(null);

  const chosenMode: Mode | null =
    fulfillment && (fulfillment === "dine_in" ? dineInAvailable : pickupAvailable)
      ? fulfillment
      : dineInAvailable
        ? "dine_in"
        : pickupAvailable
          ? "pickup"
          : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !chosenMode || !payment || cart.lines.length === 0) return;
    setError(null);
    setErrors({});

    const input: OrderInput = {
      customer: { name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) },
      fulfillment_type: chosenMode,
      payment_method: payment,
      ...(chosenMode === "dine_in" && table ? { table_identifier: table } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      items: cart.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
        addon_ids: line.addons.map((addon) => addon.id),
      })),
    };
    const fingerprint = JSON.stringify(input);
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
      attempt.current = { key: crypto.randomUUID(), fingerprint };
    }

    setBusy(true);
    try {
      const order = await createOrder(slug, attempt.current.key, input);
      attempt.current = null;
      setDone(true);
      cart.clear();
      router.push(`${base}/pedido/${encodeURIComponent(order.tracking_token)}`);
    } catch (caught) {
      setBusy(false);
      const affected = unavailableLines(caught, cart.lines);
      if (affected) {
        setFlagged(affected.map((line) => line.key));
        setError(
          `Itens que precisam de atenção: ${affected.map((line) => line.productName).join(", ")}. Remova os itens marcados no carrinho e envie de novo.`,
        );
      } else {
        setError(errorMessage(caught));
        setErrors(fieldErrors(caught));
      }
    }
  }

  if (done) {
    return (
      <p role="status" className="p-4 text-center text-muted-foreground">
        Pedido enviado. Abrindo o acompanhamento…
      </p>
    );
  }

  if (!cart.ready) {
    return <PageLoading label="Carregando o carrinho…" />;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="grid gap-4 p-4 text-center">
        <p className="text-muted-foreground">Seu carrinho está vazio.</p>
        <Link href={base} className={`${buttonVariants({ size: "lg" })} mx-auto`}>
          Ver cardápio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 p-4" aria-label="Carrinho e pedido">
      <section aria-labelledby="titulo-itens" className="grid gap-3">
        <h2 id="titulo-itens" className="text-lg font-semibold">
          Seu pedido
        </h2>
        <ul className="grid gap-3">
          {cart.lines.map((line, index) => {
            const quotedItem = quote?.items[index];
            const unavailable = flagged.includes(line.key);
            return (
              <li
                key={line.key}
                data-unavailable={unavailable || undefined}
                className={`grid gap-2 rounded-xl p-3 ring-1 ${unavailable ? "ring-destructive" : "ring-foreground/10"}`}
              >
                <div className="flex items-start gap-3">
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground"
                    >
                      {line.productName.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-medium">{line.productName}</span>
                    {line.addons.map((addon) => (
                      <span key={addon.id} className="text-sm text-muted-foreground">
                        + {addon.name}
                      </span>
                    ))}
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(line.unitPrice)} cada
                    </span>
                    {unavailable && (
                      <span className="text-sm font-medium text-destructive">
                        Indisponível no momento. Remova este item para continuar.
                      </span>
                    )}
                  </div>
                  {quotedItem && (
                    <span className="shrink-0 font-semibold" data-testid="item-subtotal">
                      {formatPrice(quotedItem.subtotal)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${line.productName}`}>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      aria-label={`Diminuir ${line.productName}`}
                      disabled={line.quantity <= 1}
                      onClick={() => cart.setQuantity(line.key, line.quantity - 1)}
                    >
                      <Minus />
                    </Button>
                    <output className="min-w-6 text-center font-medium">{line.quantity}</output>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      aria-label={`Aumentar ${line.productName}`}
                      disabled={line.quantity >= MAX_QUANTITY}
                      onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    aria-label={`Remover ${line.productName}`}
                    onClick={() => cart.remove(line.key)}
                  >
                    <Trash2 />
                    Remover
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between gap-3 border-t pt-3">
          <span className="font-medium">Total</span>
          {quote ? (
            <span className="text-lg font-semibold" data-testid="cart-total">
              {formatPrice(quote.total)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground" data-testid="cart-total-pending">
              {quoteFailed ? "Indisponível agora" : "Calculando…"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {quoteFailed
            ? "Não foi possível calcular o total agora. Você ainda pode enviar o pedido: o total final é calculado ao enviar."
            : "Valor informativo. O total final é confirmado ao enviar o pedido."}
        </p>
      </section>

      <section aria-labelledby="titulo-dados" className="grid gap-4">
        <h2 id="titulo-dados" className="text-lg font-semibold">
          Seus dados
        </h2>
        <Field
          name="name"
          label="Nome"
          autoComplete="name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors["customer.name"]}
        />
        <Field
          name="phone"
          label={chosenMode === "pickup" ? "Telefone" : "Telefone (opcional)"}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required={chosenMode === "pickup"}
          maxLength={30}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={errors["customer.phone"]}
        />

        <fieldset className="grid gap-2">
          <legend id="legenda-atendimento" className="mb-1 text-sm font-medium">
            Como você quer receber
          </legend>
          <RadioGroup
            aria-labelledby="legenda-atendimento"
            value={chosenMode ?? ""}
            onValueChange={(value) => setFulfillment(value as Mode)}
          >
            {(["dine_in", "pickup"] as const)
              .filter((mode) => modes.includes(mode))
              .map((mode) => {
                const enabled = mode === "dine_in" ? dineInAvailable : pickupAvailable;
                return (
                  <ChoiceRow
                    key={mode}
                    id={`atendimento-${mode}`}
                    value={mode}
                    disabled={!enabled}
                    onSelect={() => setFulfillment(mode)}
                  >
                    {mode === "dine_in" && tableCheck.state === "valid"
                      ? `${MODES[mode]} · ${tableCheck.name}`
                      : MODES[mode]}
                  </ChoiceRow>
                );
              })}
          </RadioGroup>
          {modes.includes("dine_in") && !dineInAvailable && (
            <p role={tableInvalid ? "status" : undefined} className="text-sm text-muted-foreground">
              {tableInvalid
                ? "O QR Code da mesa não é válido ou a mesa foi desativada. Abra o cardápio de novo pelo QR Code da mesa ou escolha retirada."
                : "Para consumir no local, abra o cardápio pelo QR Code da sua mesa."}
            </p>
          )}
          {chosenMode === null && (
            <p role="alert" className="text-sm text-destructive">
              Nenhuma forma de atendimento disponível para este acesso.
            </p>
          )}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend id="legenda-pagamento" className="mb-1 text-sm font-medium">
            Pagamento (presencial)
          </legend>
          <RadioGroup
            aria-labelledby="legenda-pagamento"
            value={payment ?? ""}
            onValueChange={(value) => setPayment(value as Payment)}
          >
            {restaurant.payment_methods.map((method) => (
              <ChoiceRow
                key={method}
                id={`pagamento-${method}`}
                value={method}
                onSelect={() => setPayment(method)}
              >
                {PAYMENTS[method]}
              </ChoiceRow>
            ))}
          </RadioGroup>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? "notes-error" : undefined}
          />
          {errors.notes && (
            <p id="notes-error" className="text-sm text-destructive">
              {errors.notes}
            </p>
          )}
        </div>
      </section>

      <FormError message={error} />
      <div className="grid gap-2">
        <Button type="submit" size="lg" disabled={busy || chosenMode === null || payment === null}>
          {busy ? "Enviando…" : "Enviar pedido"}
        </Button>
        <Link href={base} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Voltar ao cardápio
        </Link>
      </div>
    </form>
  );
}
