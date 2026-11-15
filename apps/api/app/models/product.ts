import { ProductSchema } from '#database/schema'
import { imageUrl } from '#support/images'

export type ProductAddonSummary = {
  id: string
  name: string
  description: string | null
  price: string
  is_available: boolean
}

export default class Product extends ProductSchema {
  toApi(addons: ProductAddonSummary[]) {
    return {
      id: this.id,
      category_id: this.categoryId,
      name: this.name,
      description: this.description,
      price: this.price,
      image_url: imageUrl(this.image),
      sort_order: this.sortOrder,
      is_available: this.isAvailable,
      addons,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
