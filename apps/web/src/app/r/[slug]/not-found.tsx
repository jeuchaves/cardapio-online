import { NotFoundState } from "@/components/list-states";

export default function PublicMenuNotFound() {
  return (
    <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col justify-center outline-none">
      <NotFoundState
        title="Cardápio não encontrado"
        message="Confira o endereço ou o QR Code. Este cardápio não existe ou está indisponível."
      />
    </main>
  );
}
