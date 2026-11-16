import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger'

/**
 * Defesa em profundidade (ROADMAP 7.3): campos que nunca chegam ao log, mesmo que alguém os
 * passe a um logger por engano. A sanitização principal está em `app/support/log_error.ts`.
 */
export const REDACT_PATHS = [
  '*.tracking_token',
  '*.idempotency_key',
  '*.password',
  '*.phone',
  '*.customer',
  '*.customer_name',
  '*.customer_phone',
  '*.notes',
  '*.detail',
  '*.where',
  '*.parameters',
  'req.headers.cookie',
  'req.headers.authorization',
  'tracking_token',
  'idempotency_key',
  'password',
  'phone',
  'customer',
  'notes',
]

const loggerConfig = defineConfig({
  /**
   * Default logger name used by ctx.logger and app logger calls.
   */
  default: 'app',

  loggers: {
    app: {
      /**
       * Toggle this logger on/off.
       */
      enabled: true,

      /**
       * Logger name shown in log records.
       */
      name: env.get('APP_NAME'),

      /**
       * Minimum level to output (trace, debug, info, warn, error, fatal).
       */
      level: env.get('LOG_LEVEL'),

      /**
       * Campos removidos do log (repassado ao Pino).
       */
      redact: { paths: REDACT_PATHS, censor: '[Redacted]' },

      /**
       * Use sync destination in non-production for immediate flush.
       */
      destination: !app.inProduction ? await syncDestination() : undefined,

      /**
       * Configure where logs are written.
       */
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
