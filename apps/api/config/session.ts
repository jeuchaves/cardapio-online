import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

// ADR 0002: sessão no servidor (tabela sessions); o cookie carrega só o identificador.
// Validade deslizante por inatividade (age). O limite absoluto é do absolute_session_middleware.
const sessionConfig = defineConfig({
  enabled: true,
  cookieName: env.get('SESSION_COOKIE_NAME', 'cardapio_session'),
  clearWithBrowser: false,
  age: env.get('SESSION_IDLE_TIMEOUT', '2h'),
  cookie: {
    path: '/',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
  store: 'database',
  stores: {
    database: stores.database(),
  },
})

export default sessionConfig
