import type { Metadata } from "next";
import { MapPinIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CartBar } from "@/components/cart-bar";
import { CategoryNav } from "@/components/category-nav";
import { PublicProductCard } from "@/components/public-product-card";
import { getPublicMenu } from "@/lib/public-menu";

const MODES = { dine_in: "Consumo no local", pickup: "Retirada" } as const;
const PAYMENTS = { cash: "Dinheiro", card: "Cartão", pix: "Pix" } as const;

const DESCRIPTION_LIMIT = 160;
const TABLE = /^[a-z0-9]{1,60}$/;

// Só dados públicos do restaurante (nome e descrição): sem telefone nem outros dados pessoais.
// Slug inexistente ou inativo: a página responde 404 e o Next já adiciona noindex.
export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) return {};
  const { name, description } = menu.restaurant;
  const title = `${name} — Cardápio`;
  const text = description?.trim()
    ? description.trim().slice(0, DESCRIPTION_LIMIT)
    : `Veja o cardápio de ${name} e conheça os produtos disponíveis.`;
  return {
    title,
    description: text,
    openGraph: { title, description: text, type: "website", locale: "pt_BR", siteName: name },
  };
}

// Cardápio público: sem login. Tudo vem de GET /public/restaurants/:slug; o carrinho fica no navegador.
// Com ?mesa= (QR Code da mesa), a API diz se a mesa vale e devolve o nome; a mesa só dá contexto ao
// pedido, nunca acesso.
export default async function PublicMenuPage({ params, searchParams }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const requested = typeof mesa === "string" && mesa !== "" ? mesa : null;
  const tableId = requested !== null && TABLE.test(requested) ? requested : null;
  const menu = await (tableId ? getPublicMenu(slug, tableId) : getPublicMenu(slug));
  if (!menu) notFound();
  const { restaurant, categories, table } = menu;
  const invalidTable = requested !== null && !table;

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-24 outline-none">
      <header className="grid gap-3 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {restaurant.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt=""
              width={64}
              height={64}
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
            className="inline-flex min-h-11 w-fit items-center text-sm underline"
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
        {table ? (
          <p
            className="flex w-fit items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium"
            data-testid="table-name"
          >
            <MapPinIcon className="size-4" />
            Você está na {table.name}
          </p>
        ) : null}
        {invalidTable ? (
          <div role="status" className="rounded-lg border bg-muted p-3 text-sm">
            Este QR Code de mesa não pode ser usado agora: a mesa não existe, foi desativada ou o
            consumo no local está indisponível. Você ainda pode ver o cardápio
            {restaurant.fulfillment_modes.includes("pickup") ? " e pedir para retirada" : ""}.
          </div>
        ) : null}
      </header>

      {categories.length === 0 ? (
        <p className="mx-4 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          Este cardápio ainda não tem itens disponíveis.
        </p>
      ) : (
        <>
          <CategoryNav categories={categories.map(({ id, name }) => ({ id, name }))} />

          <div className="grid gap-8 px-4 pt-6">
            {categories.map((category) => (
              <section
                key={category.id}
                id={`categoria-${category.id}`}
                aria-labelledby={`titulo-${category.id}`}
                className="grid scroll-mt-16 gap-3"
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
      <CartBar slug={restaurant.slug} />
    </main>
  );
}
