import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Checkout } from "@/components/checkout";
import { getPublicMenu } from "@/lib/public-menu";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function CartPage({ params }: PageProps<"/r/[slug]/carrinho">) {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-10 outline-none">
      <header className="px-4 pt-6">
        <p className="text-sm text-muted-foreground">{menu.restaurant.name}</p>
        <h1 className="text-2xl font-semibold">Carrinho</h1>
      </header>
      <Checkout restaurant={menu.restaurant} />
    </main>
  );
}
