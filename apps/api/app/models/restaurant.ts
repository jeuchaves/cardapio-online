import { RestaurantSchema } from '#database/schema'
import { imageUrl } from '#support/images'

export default class Restaurant extends RestaurantSchema {
  /** Representação da API: valores monetários não existem aqui; a imagem sai como `logo_url`. */
  toApi() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      phone: this.phone,
      logo_url: imageUrl(this.logo),
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
