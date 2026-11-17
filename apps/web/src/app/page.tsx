import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6 outline-none">
      <div className="grid gap-2">
        <span aria-hidden="true" className="size-3 rounded-full bg-primary" />
        <h1 className="text-3xl font-semibold tracking-tight">Cardápio Digital</h1>
        <p className="text-muted-foreground">Cardápio online e pedidos simples para o seu restaurante.</p>
      </div>
      <Link href="/entrar" className={buttonVariants({ size: "lg" })}>
        Entrar
      </Link>
    </main>
  );
}
