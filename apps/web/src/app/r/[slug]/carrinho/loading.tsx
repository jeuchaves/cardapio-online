import { PageLoading } from "@/components/list-states";

export default function Loading() {
  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-2xl flex-1 outline-none">
      <PageLoading label="Carregando o carrinho…" />
    </main>
  );
}
