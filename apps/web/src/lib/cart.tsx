"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Carrinho local do cliente (sem conta), por restaurante. Guarda só o que identifica os itens e o
// que é exibido enquanto a cotação não chega. Nunca guarda nome, telefone, observações nem token.
// Nenhum valor monetário é calculado aqui: totais e subtotais vêm da cotação da API.

export const MAX_LINES = 30;
export const MAX_QUANTITY = 20;

export type CartAddon = { id: string; name: string; price: string };

export type CartLine = {
  key: string;
  productId: string;
  productName: string;
  unitPrice: string;
  /** Miniatura exibida no carrinho; ausente em carrinhos guardados antes desta versão. */
  imageUrl: string | null;
  addons: CartAddon[];
  quantity: number;
};

type NewLine = Omit<CartLine, "key">;

type AddResult = { ok: true } | { ok: false; reason: string };

type CartContextValue = {
  lines: CartLine[];
  /** Identificador da mesa vindo do QR (?mesa=), ou null. */
  table: string | null;
  ready: boolean;
  count: number;
  add: (line: NewLine) => AddResult;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const TABLE = /^[a-z0-9]{1,60}$/;
const storageKey = (slug: string) => `cardapio:carrinho:${slug}`;

// Mesmo produto com os mesmos adicionais é a mesma linha, qualquer que seja a ordem da seleção
function lineKey(productId: string, addons: CartAddon[]) {
  return `${productId}|${addons
    .map((addon) => addon.id)
    .sort()
    .join(",")}`;
}

const isText = (value: unknown): value is string => typeof value === "string";
// O armazenamento é editável pelo usuário: só caminho do próprio site ou https vira src de imagem
const isImageUrl = (value: unknown): value is string =>
  isText(value) && value.length <= 2048 && (value.startsWith("/") && !value.startsWith("//") || value.startsWith("https://"));

// O armazenamento é entrada não confiável: só linhas bem formadas são aceitas (o backend valida de novo)
function parseLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const lines: CartLine[] = [];
  for (const raw of value.slice(0, MAX_LINES)) {
    const line = raw as Partial<CartLine> | null;
    if (
      !line ||
      !isText(line.productId) ||
      !isText(line.productName) ||
      !isText(line.unitPrice) ||
      !Array.isArray(line.addons) ||
      !Number.isInteger(line.quantity) ||
      line.quantity! < 1 ||
      line.quantity! > MAX_QUANTITY
    ) {
      continue;
    }
    const addons = line.addons.filter(
      (addon): addon is CartAddon =>
        !!addon && isText(addon.id) && isText(addon.name) && isText(addon.price),
    );
    lines.push({
      key: lineKey(line.productId, addons),
      productId: line.productId,
      productName: line.productName,
      unitPrice: line.unitPrice,
      imageUrl: isImageUrl(line.imageUrl) ? line.imageUrl : null,
      addons,
      quantity: line.quantity!,
    });
  }
  return lines;
}

function readStorage(slug: string): { lines: CartLine[]; table: string | null } {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return { lines: [], table: null };
    const parsed = JSON.parse(raw) as { lines?: unknown; table?: unknown };
    return {
      lines: parseLines(parsed.lines),
      table: isText(parsed.table) && TABLE.test(parsed.table) ? parsed.table : null,
    };
  } catch {
    return { lines: [], table: null };
  }
}

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [table, setTable] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Carrega no navegador (o servidor não tem localStorage) e lê ?mesa= do QR Code
  useEffect(() => {
    const stored = readStorage(slug);
    const fromUrl = new URLSearchParams(window.location.search).get("mesa");
    // localStorage só existe no navegador: a leitura não pode acontecer na renderização do servidor
    /* eslint-disable react-hooks/set-state-in-effect */
    setLines(stored.lines);
    setTable(fromUrl && TABLE.test(fromUrl) ? fromUrl : stored.table);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify({ lines, table }));
    } catch {
      // Sem armazenamento (modo privado, cota): o carrinho continua só em memória
    }
  }, [ready, slug, lines, table]);

  const add = useCallback(
    (line: NewLine): AddResult => {
      const key = lineKey(line.productId, line.addons);
      const existing = lines.find((item) => item.key === key);
      if (existing) {
        if (existing.quantity + line.quantity > MAX_QUANTITY) {
          return { ok: false, reason: `Quantidade máxima por item: ${MAX_QUANTITY}.` };
        }
        setLines((current) =>
          current.map((item) =>
            item.key === key ? { ...item, quantity: item.quantity + line.quantity } : item,
          ),
        );
        return { ok: true };
      }
      if (lines.length >= MAX_LINES) {
        return { ok: false, reason: `O carrinho aceita até ${MAX_LINES} itens diferentes.` };
      }
      setLines((current) => [...current, { ...line, key }]);
      return { ok: true };
    },
    [lines],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    if (quantity < 1 || quantity > MAX_QUANTITY) return;
    setLines((current) => current.map((item) => (item.key === key ? { ...item, quantity } : item)));
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      table,
      ready,
      // Contagem de unidades (inteiros), não de dinheiro
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, table, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de CartProvider.");
  return context;
}
