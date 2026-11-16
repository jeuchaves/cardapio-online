import Big from 'big.js'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import ApiError from '#exceptions/api_error'

export type CartLine = { product_id: string; quantity: number; addon_ids: string[] }

type CatalogProduct = { id: string; name: string; price: string }
type CatalogAddon = { product_id: string; id: string; name: string; price: string }

export type Catalog = { products: CatalogProduct[]; addons: CatalogAddon[] }

export type PricedLine = {
  product_id: string
  name: string
  quantity: number
  unit_price: string
  addons: { id: string; name: string; unit_price: string }[]
  subtotal: string
}

/** Subtotal do adicional no snapshot: preço por unidade do item × quantidade do item. */
export function addonSubtotal(unitPrice: string, quantity: number) {
  return new Big(unitPrice).times(quantity).toFixed(2)
}

/**
 * Lê produtos e adicionais do restaurante que podem ser pedidos agora, travando as linhas
 * (FOR SHARE) até o fim da transação. Deve rodar dentro de uma transação.
 * Produto ou adicional indisponível, de outro restaurante ou sem vínculo simplesmente não vem.
 */
export async function loadCatalog(
  client: QueryClientContract,
  restaurantId: string,
  lines: CartLine[]
): Promise<Catalog> {
  const productIds = lines.map((line) => line.product_id)
  const addonIds = [...new Set(lines.flatMap((line) => line.addon_ids))]

  const products = await client
    .from('products')
    .where('restaurant_id', restaurantId)
    .whereIn('id', productIds)
    .where('is_available', true)
    .forShare()
    .select('id', 'name', 'price')

  const addons =
    addonIds.length === 0
      ? []
      : await client
          .from('product_product_addons as link')
          .join('product_addons as addon', 'addon.id', 'link.product_addon_id')
          .where('link.restaurant_id', restaurantId)
          .where('addon.restaurant_id', restaurantId)
          .whereIn('link.product_id', productIds)
          .whereIn('addon.id', addonIds)
          .where('addon.is_available', true)
          .forShare()
          .select('link.product_id', 'addon.id', 'addon.name', 'addon.price')

  return { products, addons }
}

/**
 * Preços do carrinho: subtotal do item = (preço do produto + soma dos adicionais) × quantidade;
 * total = soma dos subtotais. Todo cálculo é em big.js e os valores saem como string com 2 casas.
 * Lança 422 ITEM_UNAVAILABLE com os ids afetados se algum item não puder ser pedido.
 */
export function priceCart(lines: CartLine[], catalog: Catalog) {
  const products = new Map(catalog.products.map((product) => [product.id, product]))
  const addons = new Map(catalog.addons.map((addon) => [`${addon.product_id}:${addon.id}`, addon]))

  const badProducts = new Set<string>()
  const badAddons = new Set<string>()
  for (const line of lines) {
    if (!products.has(line.product_id)) badProducts.add(line.product_id)
    for (const addonId of line.addon_ids) {
      if (!addons.has(`${line.product_id}:${addonId}`)) badAddons.add(addonId)
    }
  }
  if (badProducts.size > 0 || badAddons.size > 0) {
    throw new ApiError(422, 'ITEM_UNAVAILABLE', 'Alguns itens do pedido não estão disponíveis.', {
      product_ids: [...badProducts],
      addon_ids: [...badAddons],
    })
  }

  let total = new Big(0)
  const items: PricedLine[] = lines.map((line) => {
    const product = products.get(line.product_id)!
    const chosen = line.addon_ids.map((addonId) => addons.get(`${line.product_id}:${addonId}`)!)
    const perUnit = chosen.reduce((sum, addon) => sum.plus(addon.price), new Big(product.price))
    const subtotal = perUnit.times(line.quantity)
    total = total.plus(subtotal)
    return {
      product_id: product.id,
      name: product.name,
      quantity: line.quantity,
      unit_price: new Big(product.price).toFixed(2),
      addons: chosen.map((addon) => ({
        id: addon.id,
        name: addon.name,
        unit_price: new Big(addon.price).toFixed(2),
      })),
      subtotal: subtotal.toFixed(2),
    }
  })

  return { items, total: total.toFixed(2) }
}
