/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| Sessão e autenticação são registradas por grupo (ADR 0002): /public nunca as usa.
| Todo grupo com sessão passa antes pelo middleware de Origin (CSRF).
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('health', [controllers.Health, 'show'])

    // Autenticação
    router
      .group(() => {
        router.post('login', [controllers.Auth, 'login'])

        router
          .group(() => {
            // Permitidos com must_change_password = true
            router.post('logout', [controllers.Auth, 'logout'])
            router.patch('password', [controllers.Auth, 'changePassword'])

            router.get('me', [controllers.Auth, 'me']).use(middleware.passwordChange())
          })
          .use([middleware.auth(), middleware.absoluteSession()])
      })
      .prefix('auth')
      .use([middleware.origin(), middleware.session(), middleware.initializeAuth()])

    // Administração da plataforma (platform_admin)
    router
      .group(() => {
        router.get('restaurants', [controllers.PlatformRestaurants, 'index'])
        router.post('restaurants', [controllers.PlatformRestaurants, 'store'])
        router.get('restaurants/:id', [controllers.PlatformRestaurants, 'show'])
        router.patch('restaurants/:id', [controllers.PlatformRestaurants, 'update'])
        router.patch('restaurants/:id/status', [controllers.PlatformRestaurants, 'updateStatus'])
        router.post('restaurants/:id/owner/reset-password', [
          controllers.PlatformRestaurants,
          'resetOwnerPassword',
        ])
      })
      .prefix('platform')
      .use([
        middleware.origin(),
        middleware.session(),
        middleware.initializeAuth(),
        middleware.auth(),
        middleware.absoluteSession(),
        middleware.passwordChange(),
        middleware.platformAdmin(),
      ])

    // Painel do restaurante: o vínculo ativo do usuário é validado a cada requisição
    router
      .group(() => {
        router.get('restaurant', [controllers.TenantRestaurant, 'show'])

        router.get('categories', [controllers.Categories, 'index'])
        router.post('categories', [controllers.Categories, 'store'])
        router.patch('categories/:id', [controllers.Categories, 'update'])

        router.get('products', [controllers.Products, 'index'])
        router.post('products', [controllers.Products, 'store'])
        router.patch('products/:id', [controllers.Products, 'update'])
        router.put('products/:id/addons', [controllers.Products, 'replaceAddons'])
        router.put('products/:id/image', [controllers.Products, 'putImage'])

        router.get('addons', [controllers.Addons, 'index'])
        router.post('addons', [controllers.Addons, 'store'])
        router.patch('addons/:id', [controllers.Addons, 'update'])

        // Somente owner
        router
          .group(() => {
            router.patch('restaurant', [controllers.TenantRestaurant, 'update'])
            router.patch('restaurant/settings', [controllers.TenantRestaurant, 'updateSettings'])
            router.put('restaurant/logo', [controllers.TenantRestaurant, 'putLogo'])

            router.get('staff', [controllers.Staff, 'index'])
            router.post('staff', [controllers.Staff, 'store'])
            router.patch('staff/:userId', [controllers.Staff, 'update'])
            router.post('staff/:userId/reset-password', [controllers.Staff, 'resetPassword'])

            router.delete('categories/:id', [controllers.Categories, 'destroy'])
            router.delete('products/:id', [controllers.Products, 'destroy'])
            router.delete('products/:id/image', [controllers.Products, 'destroyImage'])
            router.delete('addons/:id', [controllers.Addons, 'destroy'])

            router.get('tables', [controllers.Tables, 'index'])
            router.post('tables', [controllers.Tables, 'store'])
            router.patch('tables/:id', [controllers.Tables, 'update'])
            router.delete('tables/:id', [controllers.Tables, 'destroy'])
          })
          .use(middleware.ownerOnly())
      })
      .prefix('tenant/:restaurantId')
      .use([
        middleware.cleanupUploads(),
        middleware.origin(),
        middleware.session(),
        middleware.initializeAuth(),
        middleware.auth(),
        middleware.absoluteSession(),
        middleware.passwordChange(),
        middleware.tenant(),
      ])
  })
  .prefix('/api/v1')

// Leitura pública das imagens (ADR 0003): sem sessão, só chaves no formato estrito
router.get('/uploads/*', [controllers.Uploads, 'show'])
