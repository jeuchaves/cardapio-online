import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto do cardápio enquanto o servidor busca os dados: mesma estrutura da página (cabeçalho,
// barra de categorias e cartões), para o conteúdo não pular quando chegar.
export default function Loading() {
  return (
    <main
      id="conteudo"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-24 outline-none"
    >
      <p role="status" className="sr-only">
        Carregando o cardápio…
      </p>
      <div className="grid gap-3 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 border-b px-4 py-2">
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <div className="grid gap-3 px-4 pt-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </main>
  );
}
