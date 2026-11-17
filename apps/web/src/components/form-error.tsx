"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";

// Mensagem do erro da API; os erros por campo são exibidos junto de cada Field.
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") return "Muitas tentativas. Aguarde um minuto e tente novamente.";
    // Erro do servidor: o texto da API pode ter detalhe interno, então a pessoa vê a mensagem de comunicação
    if (error.status >= 500) return "O servidor não respondeu como esperado. Tente novamente em instantes.";
    return error.message;
  }
  return "Não foi possível concluir. Verifique sua conexão e tente novamente.";
}

// Três categorias, apresentadas de forma distinta: validação (junto do campo), negócio (regra
// recusada pela API, como 409 e 422 sem campo) e comunicação (rede ou 5xx, com nova tentativa).
export type ErrorKind = "validation" | "business" | "communication";

export function errorKind(error: unknown): ErrorKind {
  if (!(error instanceof ApiError)) return "communication";
  if (error.status >= 500) return "communication";
  if (error.details?.some((detail) => detail.field)) return "validation";
  return "business";
}

type Validatable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isValidatable(element: Element): element is Validatable {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

// Valida pelos atributos nativos do campo (required, maxLength, min, max, type, pattern), que continuam
// sendo a única fonte das regras do cliente, mas com mensagem própria junto do campo em vez do balão do
// navegador. Campos desabilitados não entram (`willValidate`). O servidor segue sendo a fonte de verdade.
// O formulário precisa de noValidate. A chave do resultado é o `name` do campo.
export function validateForm(form: HTMLFormElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const element of Array.from(form.elements)) {
    if (!isValidatable(element) || !element.name || !element.willValidate || element.validity.valid) continue;
    // Campo com controle próprio (Select do Base UI): o input escondido não tem id, e o rótulo aponta
    // para o gatilho, que usa o mesmo valor do `name`
    const labelNode =
      (element.id ? form.querySelector<HTMLLabelElement>(`label[for="${element.id}"]`) : null) ??
      form.querySelector<HTMLLabelElement>(`label[for="${element.name}"]`);
    const label = labelNode?.textContent?.replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
    const subject = label ?? "Este campo";
    const validity = element.validity;
    let reason = "valor inválido.";
    if (validity.valueMissing) reason = "preencha este campo.";
    else if (validity.tooLong) reason = `use no máximo ${(element as HTMLInputElement).maxLength} caracteres.`;
    else if (validity.tooShort) reason = `use pelo menos ${(element as HTMLInputElement).minLength} caracteres.`;
    else if (validity.rangeUnderflow) reason = `o menor valor aceito é ${(element as HTMLInputElement).min}.`;
    else if (validity.rangeOverflow) reason = `o maior valor aceito é ${(element as HTMLInputElement).max}.`;
    else if (validity.badInput || validity.stepMismatch) reason = "informe um número inteiro.";
    else if (validity.typeMismatch) reason = "informe um valor no formato correto.";
    else if (validity.patternMismatch) reason = element.title || "informe um valor no formato correto.";
    result[element.name] = `${subject}: ${reason}`;
  }
  return result;
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details) return {};
  const result: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.field && !(detail.field in result)) result[detail.field] = detail.message;
  }
  return result;
}

// Leva o foco ao primeiro campo inválido ou, sem campo, à mensagem de erro. Chamar num efeito,
// depois que o erro foi renderizado. Sem `root`, procura na página inteira (só o formulário que
// acabou de falhar tem campos marcados).
export function focusFirstError(root: ParentNode | null = document) {
  const target =
    root?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root?.querySelector<HTMLElement>('[role="alert"]');
  target?.focus();
}

// Estado de erro de uma tela com formulários: mensagem da API (com a categoria), erros por campo e
// foco no primeiro erro. Todos os formulários do painel e da plataforma usam o mesmo caminho:
//   reset(); if (invalid(form)) return;  ...  try { await api(...) } catch (err) { fail(err); }
// `report` é para ações que não são formulário (ativar, excluir, carregar): só a mensagem.
export function useFormFeedback() {
  const [error, setError] = useState<{ message: string; kind: ErrorKind } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (error || Object.keys(fields).length > 0) focusFirstError();
  }, [error, fields]);

  const clearError = useCallback(() => setError(null), []);
  const reset = useCallback(() => {
    setError(null);
    setFields({});
  }, []);
  const report = useCallback((caught: unknown) => {
    setError({ message: errorMessage(caught), kind: errorKind(caught) });
  }, []);
  const fail = useCallback(
    (caught: unknown) => {
      report(caught);
      setFields(fieldErrors(caught));
    },
    [report],
  );
  // true quando há campo inválido; os erros aparecem junto dos campos e nada é enviado
  const invalid = useCallback((form: HTMLFormElement) => {
    const local = validateForm(form);
    if (Object.keys(local).length === 0) return false;
    setError(null);
    setFields(local);
    return true;
  }, []);

  return { error: error?.message ?? null, kind: error?.kind, fields, setFields, clearError, reset, report, fail, invalid };
}

export function FormError({ message, kind }: { message: string | null; kind?: ErrorKind }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert" tabIndex={-1} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <AlertDescription>
        {kind === "communication" ? <strong className="block">Falha de comunicação</strong> : null}
        {message}
        {kind === "communication" ? " O que você digitou foi mantido: tente de novo." : null}
      </AlertDescription>
    </Alert>
  );
}
