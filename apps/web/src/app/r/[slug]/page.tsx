import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PublicProductCard } from "@/components/public-product-card";
import { getPublicMenu } from "@/lib/public-menu";

const MODES = { dine_in: "Consumo no local", pickup: "Retirada" } as const;
const PAYMENTS = { cash: "Dinheiro", card: "Cartão", pix: "Pix" } as const;

// Cardápio público: sem login e sem carrinho (Fase 5). Tudo vem de GET /public/restaurants/:slug.
export default async function PublicMenuPage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();
  const { restaurant, categories } = menu;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-10">
      <header className="grid gap-3 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {restaurant.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt=""
              className="size-16 shrink-0 rounded-full border object-cover"
            />
          )}
          <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
        </div>
        {restaurant.description && (
          <p className="text-sm text-muted-foreground">{restaurant.description}</p>
        )}
        {restaurant.phone && (
          <a
            href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
            className="w-fit text-sm underline"
          >
            {restaurant.phone}
          </a>
        )}
        <div className="flex flex-wrap gap-2" aria-label="Atendimento e pagamento">
          {restaurant.fulfillment_modes.map((mode) => (
            <Badge key={mode} variant="secondary">
              {MODES[mode]}
            </Badge>
          ))}
          {restaurant.payment_methods.map((method) => (
            <Badge key={method} variant="outline">
              {PAYMENTS[method]}
            </Badge>
          ))}
        </div>
      </header>

      {categories.length === 0 ? (
        <p className="mx-4 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          Este cardápio ainda não tem itens disponíveis.
        </p>
      ) : (
        <>
          <nav
            aria-label="Categorias"
            className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur"
          >
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#categoria-${category.id}`}
                className="shrink-0 rounded-full border px-3 py-1 text-sm hover:bg-muted"
              >
                {category.name}
              </a>
            ))}
          </nav>

          <div className="grid gap-8 px-4 pt-6">
            {categories.map((category) => (
              <section
                key={category.id}
                id={`categoria-${category.id}`}
                aria-labelledby={`titulo-${category.id}`}
                className="grid scroll-mt-14 gap-3"
              >
                <div>
                  <h2 id={`titulo-${category.id}`} className="text-lg font-semibold">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  )}
                </div>
                <ul className="grid gap-3">
                  {category.products.map((product) => (
                    <li key={product.id}>
                      <PublicProductCard product={product} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
