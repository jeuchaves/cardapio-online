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

// Valida pelos atributos nativos do campo (required, maxLength, type), que continuam sendo a única
// fonte das regras do cliente, mas com mensagem própria junto do campo em vez do balão do navegador.
// O servidor segue sendo a fonte de verdade. O formulário precisa de noValidate.
export function validateForm(form: HTMLFormElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) continue;
    if (!element.name || element.validity.valid) continue;
    const label = form.querySelector<HTMLLabelElement>(`label[for="${element.id}"]`)?.textContent
      ?.replace(/s*(opcional)s*$/, "")
      .trim();
    const subject = label ?? "Este campo";
    if (element.validity.valueMissing) result[element.name] = `${subject}: preencha este campo.`;
    else if (element.validity.tooLong) result[element.name] = `${subject}: use no máximo ${element.maxLength} caracteres.`;
    else if (element.validity.typeMismatch) result[element.name] = `${subject}: informe um valor no formato correto.`;
    else result[element.name] = `${subject}: valor inválido.`;
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
// depois que o erro foi renderizado.
export function focusFirstError(form: HTMLFormElement | null) {
  const target =
    form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    form?.querySelector<HTMLElement>('[role="alert"]');
  target?.focus();
}

export function FormError({ message, kind }: { message: string | null; kind?: ErrorKind }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert" tabIndex={-1} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <AlertDescription>
        {kind === "communication" ? <strong className="block">Falha de comunicação</strong> : null}
        {message}
        {kind === "communication" ? " O que você digitou foi mantido: envie de novo." : null}
      </AlertDescription>
    </Alert>
  );
}
