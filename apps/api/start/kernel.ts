/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([() => import('@adonisjs/core/bodyparser_middleware')])

/**
 * Sessão e autenticação NÃO são globais (ADR 0002, adendo): cada grupo de rotas
 * as registra, para que /public nunca leia nem renove o cookie de sessão.
 */
export const middleware = router.named({
  session: () => import('@adonisjs/session/session_middleware'),
  initializeAuth: () => import('@adonisjs/auth/initialize_auth_middleware'),
  auth: () => import('#middleware/auth_middleware'),
  origin: () => import('#middleware/origin_middleware'),
  cleanupUploads: () => import('#middleware/cleanup_uploads_middleware'),
  absoluteSession: () => import('#middleware/absolute_session_middleware'),
  passwordChange: () => import('#middleware/password_change_middleware'),
  platformAdmin: () => import('#middleware/platform_admin_middleware'),
  tenant: () => import('#middleware/tenant_middleware'),
  ownerOnly: () => import('#middleware/owner_only_middleware'),
})
