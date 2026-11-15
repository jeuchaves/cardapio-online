import { RestaurantTableSchema } from '#database/schema'

export default class RestaurantTable extends RestaurantTableSchema {
  toApi() {
    return {
      id: this.id,
      name: this.name,
      identifier: this.identifier,
      is_active: this.isActive,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
