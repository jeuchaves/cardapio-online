import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";

// Mensagem do erro da API; os erros por campo são exibidos junto de cada Field.
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") return "Muitas tentativas. Aguarde um minuto e tente novamente.";
    return error.message;
  }
  return "Não foi possível concluir. Verifique sua conexão e tente novamente.";
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

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert" tabIndex={-1} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
