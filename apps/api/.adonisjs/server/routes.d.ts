import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.change_password': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'public_menu.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public_orders.store': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public_cart.quote': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public_tracking.show': { paramsTuple: [ParamValue]; params: {'trackingToken': ParamValue} }
    'platform_restaurants.index': { paramsTuple?: []; params?: {} }
    'platform_restaurants.store': { paramsTuple?: []; params?: {} }
    'platform_restaurants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.update_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.reset_owner_password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.show': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'categories.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'categories.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'products.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.replace_addons': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.put_image': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'order_status.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'addons.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'addons.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'addons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'tenant_restaurant.update': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tenant_restaurant.update_settings': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tenant_restaurant.put_logo': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
    'staff.reset_password': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.destroy_image': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'addons.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'tables.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tables.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tables.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'tables.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'uploads.show': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  GET: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'public_menu.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public_tracking.show': { paramsTuple: [ParamValue]; params: {'trackingToken': ParamValue} }
    'platform_restaurants.index': { paramsTuple?: []; params?: {} }
    'platform_restaurants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.show': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'categories.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'addons.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tables.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'uploads.show': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  HEAD: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'public_menu.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public_tracking.show': { paramsTuple: [ParamValue]; params: {'trackingToken': ParamValue} }
    'platform_restaurants.index': { paramsTuple?: []; params?: {} }
    'platform_restaurants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.show': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'categories.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'addons.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tables.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'uploads.show': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  POST: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'public_orders.store': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public_cart.quote': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'platform_restaurants.store': { paramsTuple?: []; params?: {} }
    'platform_restaurants.reset_owner_password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'products.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'addons.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.reset_password': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
    'tables.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
  }
  PATCH: {
    'auth.change_password': { paramsTuple?: []; params?: {} }
    'platform_restaurants.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.update_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'order_status.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'addons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'tenant_restaurant.update': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tenant_restaurant.update_settings': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
    'tables.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
  }
  PUT: {
    'products.replace_addons': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.put_image': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'tenant_restaurant.put_logo': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
  }
  DELETE: {
    'categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'products.destroy_image': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'addons.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
    'tables.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}