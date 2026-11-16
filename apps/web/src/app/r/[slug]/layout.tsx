import { CartProvider } from "@/lib/cart";

// O carrinho vive sob /r/:slug e persiste entre o cardápio, o carrinho e o acompanhamento.
export default async function RestaurantLayout({ children, params }: LayoutProps<"/r/[slug]">) {
  const { slug } = await params;
  return <CartProvider slug={slug}>{children}</CartProvider>;
}
