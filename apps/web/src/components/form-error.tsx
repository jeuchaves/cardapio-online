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

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function SuccessMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert role="status">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
