import { ProductAddonSchema } from '#database/schema'

export default class ProductAddon extends ProductAddonSchema {
  toApi() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      is_available: this.isAvailable,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
