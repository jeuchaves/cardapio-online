import type { Metadata } from "next";
import { OrderTracking } from "@/components/order-tracking";

// O token está na URL: sem indexação, sem Referer e sem cache (headers em next.config.ts).
export const metadata: Metadata = {
  title: "Acompanhar pedido",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TrackingPage({ params }: PageProps<"/r/[slug]/pedido/[token]">) {
  const { slug, token } = await params;
  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-10 outline-none">
      <header className="px-4 pt-6">
        <h1 className="text-2xl font-semibold">Acompanhar pedido</h1>
      </header>
      <OrderTracking token={token} slug={slug} />
    </main>
  );
}
