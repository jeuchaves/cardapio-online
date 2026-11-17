import type { Metadata } from "next";
import { MapPinIcon, PhoneIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { ExpandableText } from "@/components/expandable-text";
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
      <header className="mx-4 mt-4 grid gap-4 rounded-2xl bg-accent p-4 text-accent-foreground">
        <div className="flex items-center gap-4">
          {restaurant.logo_url ? (
            // Caixa de proporção fixa: logo largo, alto ou quadrado cabe inteiro, sem deslocar o layout
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt=""
              width={80}
              height={64}
              className="h-16 w-20 shrink-0 rounded-xl bg-card object-contain p-1 ring-1 ring-border"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary text-2xl font-semibold text-primary-foreground"
            >
              {restaurant.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className="min-w-0 text-2xl leading-tight font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">
            {restaurant.name}
          </h1>
        </div>
        {restaurant.description && <ExpandableText className="text-base">{restaurant.description}</ExpandableText>}
        <p className="grid gap-0.5 text-sm" aria-label="Atendimento e pagamento">
          <span>
            <span className="font-medium">Atendimento: </span>
            {restaurant.fulfillment_modes.map((mode) => MODES[mode]).join(" · ")}
          </span>
          <span>
            <span className="font-medium">Pagamento presencial: </span>
            {restaurant.payment_methods.map((method) => PAYMENTS[method]).join(" · ")}
          </span>
        </p>
        {restaurant.phone && (
          <a
            href={`tel:${restaurant.phone.replace(/[^d+]/g, "")}`}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium"
          >
            <PhoneIcon className="size-4" />
            {restaurant.phone}
          </a>
        )}
        {table ? (
          <p
            className="flex w-fit items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-medium ring-1 ring-border"
            data-testid="table-name"
          >
            <MapPinIcon className="size-4" />
            Você está na {table.name}
          </p>
        ) : null}
        {invalidTable ? (
          <div role="status" className="rounded-lg border bg-card p-3 text-sm">
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

          <div className="grid gap-10 px-4 pt-6">
            {categories.map((category) => (
              <section
                key={category.id}
                id={`categoria-${category.id}`}
                aria-labelledby={`titulo-${category.id}`}
                className="grid scroll-mt-20 gap-3"
              >
                <div>
                  <h2 id={`titulo-${category.id}`} className="text-xl font-semibold tracking-tight">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  )}
                </div>
                <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
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
