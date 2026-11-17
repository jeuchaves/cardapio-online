import { NotFoundState } from "@/components/list-states";

export default function NotFound() {
  return (
    <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col justify-center outline-none">
      <NotFoundState
        title="Página não encontrada"
        message="Confira o endereço digitado. Esta página não existe."
        home
      />
    </main>
  );
}
