import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Estados padrão de lista e de página: carregando, vazio, erro e não encontrado.

export function ListSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// Carregamento de página inteira (sessão, carrinho, acompanhamento e `loading.tsx` dos segmentos)
export function PageLoading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-4 p-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function EmptyList({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{children}</p>;
}

export function ErrorState({
  title = "Algo deu errado",
  message = "Tente novamente em instantes.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="grid justify-items-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button size="lg" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

export function NotFoundState({
  title,
  message,
  home = false,
}: {
  title: string;
  message: string;
  home?: boolean;
}) {
  return (
    <div className="grid justify-items-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      {home ? (
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Ir para o início
        </Link>
      ) : null}
    </div>
  );
}
