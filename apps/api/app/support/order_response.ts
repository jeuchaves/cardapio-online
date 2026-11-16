import db from '@adonisjs/lucid/services/db'
import type { PricedLine } from '#support/order_cart'

export type OrderBody = {
  order_number: number
  tracking_token: string
  status: string
  total: string
  items: PricedLine[]
}

// Comparação por unidade de código: determinística, igual na criação (201) e no replay (200)
function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Linha do pedido com os ids persistentes (order_items.id e order_item_addons.id) do desempate. */
export type IdentifiedLine = Omit<PricedLine, 'addons'> & {
  row_id: string
  addons: (PricedLine['addons'][number] & { row_id: string })[]
}

/**
 * Ordem canônica do pedido: itens por nome, id do produto e id da linha; adicionais por nome, id
 * do adicional e id da linha. Os ids das linhas são persistentes e nunca nulos, então a ordem
 * continua determinística mesmo quando produto ou adicional foram excluídos (referência nula).
 * O hash trata a ordem do carrinho como irrelevante, então a resposta também não depende dela.
 * Devolve o corpo da API, sem os ids das linhas.
 */
export function sortOrderItems(lines: IdentifiedLine[]): PricedLine[] {
  return [...lines]
    .sort(
      (a, b) =>
        compare(a.name, b.name) ||
        compare(a.product_id ?? '', b.product_id ?? '') ||
        compare(a.row_id, b.row_id)
    )
    .map(({ row_id: _rowId, addons, ...line }) => ({
      ...line,
      addons: [...addons]
        .sort(
          (x, y) =>
            compare(x.name, y.name) ||
            compare(x.id ?? '', y.id ?? '') ||
            compare(x.row_id, y.row_id)
        )
        .map(({ row_id: _addonRowId, ...addon }) => addon),
    }))
}

type OrderRow = {
  id: string
  order_number: number
  tracking_token: string
  status: string
  total: string
}

/**
 * Lê os snapshots de itens e adicionais do pedido, sem consultar o catálogo. Toda leitura filtra
 * pelo restaurante dono do pedido. Os ids das linhas servem só para a ordem canônica.
 */
export async function loadOrderLines(
  restaurantId: string,
  orderId: string
): Promise<IdentifiedLine[]> {
  const items = await db
    .from('order_items')
    .where('restaurant_id', restaurantId)
    .where('order_id', orderId)
    .select('id', 'product_id', 'product_name', 'quantity', 'unit_price', 'subtotal')

  const addons =
    items.length === 0
      ? []
      : await db
          .from('order_item_addons')
          .where('restaurant_id', restaurantId)
          .whereIn(
            'order_item_id',
            items.map((item) => item.id)
          )
          .select('id', 'order_item_id', 'product_addon_id', 'addon_name', 'unit_price')

  return items.map((item) => ({
    row_id: item.id,
    product_id: item.product_id,
    name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    addons: addons
      .filter((addon) => addon.order_item_id === item.id)
      .map((addon) => ({
        row_id: addon.id,
        id: addon.product_addon_id,
        name: addon.addon_name,
        unit_price: addon.unit_price,
      })),
    subtotal: item.subtotal,
  }))
}

/**
 * Reconstrói o corpo do pedido a partir dos snapshots gravados, sem consultar o catálogo.
 * Mostra o status atual do pedido. Toda leitura filtra pelo restaurante.
 */
export async function loadOrderBody(restaurantId: string, order: OrderRow): Promise<OrderBody> {
  return {
    order_number: order.order_number,
    tracking_token: order.tracking_token,
    status: order.status,
    total: order.total,
    items: sortOrderItems(await loadOrderLines(restaurantId, order.id)),
  }
}
