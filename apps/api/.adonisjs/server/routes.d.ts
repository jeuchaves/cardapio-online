import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.change_password': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'platform_restaurants.index': { paramsTuple?: []; params?: {} }
    'platform_restaurants.store': { paramsTuple?: []; params?: {} }
    'platform_restaurants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.update_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.reset_owner_password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.show': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tenant_restaurant.update': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tenant_restaurant.update_settings': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
    'staff.reset_password': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
  }
  GET: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'platform_restaurants.index': { paramsTuple?: []; params?: {} }
    'platform_restaurants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.show': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
  }
  HEAD: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'platform_restaurants.index': { paramsTuple?: []; params?: {} }
    'platform_restaurants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.show': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.index': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
  }
  POST: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'platform_restaurants.store': { paramsTuple?: []; params?: {} }
    'platform_restaurants.reset_owner_password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'staff.store': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.reset_password': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
  }
  PATCH: {
    'auth.change_password': { paramsTuple?: []; params?: {} }
    'platform_restaurants.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'platform_restaurants.update_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tenant_restaurant.update': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'tenant_restaurant.update_settings': { paramsTuple: [ParamValue]; params: {'restaurantId': ParamValue} }
    'staff.update': { paramsTuple: [ParamValue,ParamValue]; params: {'restaurantId': ParamValue,'userId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}