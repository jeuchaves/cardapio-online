"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Field } from "@/components/field";
import { formatPhone, normalizePhone } from "@/lib/phone";

type PhoneFieldProps = Omit<
  React.ComponentProps<typeof Field>,
  "type" | "value" | "defaultValue" | "onChange" | "maxLength" | "inputMode" | "hint"
> & {
  defaultValue?: string;
  /** Recebe o valor normalizado (só dígitos), o mesmo que deve ir para a API. */
  onDigitsChange?: (digits: string) => void;
};

// Campo de telefone com máscara visual. Colar, editar no meio e apagar mantêm o cursor no lugar;
// nenhum dígito é descartado em silêncio (só o que passa de 13).
export function PhoneField({ defaultValue = "", onDigitsChange, ...props }: PhoneFieldProps) {
  const [digits, setDigits] = useState(() => normalizePhone(defaultValue));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretDigits = useRef<number | null>(null);

  // Depois de reformatar, o cursor volta para depois do mesmo número de dígitos
  useLayoutEffect(() => {
    const input = inputRef.current;
    const wanted = caretDigits.current;
    caretDigits.current = null;
    if (!input || wanted === null) return;
    let seen = 0;
    let position = 0;
    while (position < input.value.length && seen < wanted) {
      if (/\d/.test(input.value[position])) seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  }, [digits]);

  return (
    <Field
      {...props}
      ref={inputRef}
      type="tel"
      autoComplete="tel"
      inputMode="tel"
      hint="Com DDD, só números. Exemplo: (11) 99999-0001"
      value={formatPhone(digits)}
      onChange={(event) => {
        const raw = event.target.value;
        const caret = event.target.selectionStart ?? raw.length;
        caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
        const next = normalizePhone(raw);
        setDigits(next);
        onDigitsChange?.(next);
      }}
    />
  );
}
