import { RestaurantSchema } from '#database/schema'

export default class Restaurant extends RestaurantSchema {
  /** Representação da API: valores monetários não existem aqui; sem `logo` até haver upload. */
  toApi() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      phone: this.phone,
      is_active: this.isActive,
      accepts_dine_in: this.acceptsDineIn,
      accepts_pickup: this.acceptsPickup,
      accepts_cash: this.acceptsCash,
      accepts_card: this.acceptsCard,
      accepts_pix: this.acceptsPix,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
