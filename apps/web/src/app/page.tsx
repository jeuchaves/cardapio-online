import Link from "next/link";
import { ApiStatus } from "@/components/api-status";

export default function Home() {
  return (
    <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center gap-4 p-6 outline-none">
      <h1 className="text-2xl font-semibold">Cardápio Digital</h1>
      <Link href="/entrar" className="underline">
        Entrar
      </Link>
      <ApiStatus />
    </main>
  );
}
