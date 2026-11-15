import { CategorySchema } from '#database/schema'

export default class Category extends CategorySchema {
  toApi() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      sort_order: this.sortOrder,
      is_active: this.isActive,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
