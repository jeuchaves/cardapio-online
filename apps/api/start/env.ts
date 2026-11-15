/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_NAME: Env.schema.string(),
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Banco de dados (PostgreSQL)
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

  // Sessão (ADR 0002). Padrões: cookie cardapio_session, 2h de inatividade, 12h absolutas
  SESSION_COOKIE_NAME: Env.schema.string.optional(),
  SESSION_IDLE_TIMEOUT: Env.schema.string.optional(),
  SESSION_ABSOLUTE_HOURS: Env.schema.number.optional(),

  // Rate limit por minuto (ADR 0004). Padrões: 5, 20 e 5
  LIMITER_LOGIN_IP_EMAIL_PER_MINUTE: Env.schema.number.optional(),
  LIMITER_LOGIN_IP_PER_MINUTE: Env.schema.number.optional(),
  LIMITER_PASSWORD_PER_MINUTE: Env.schema.number.optional(),
})
