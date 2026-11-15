import { defineConfig, stores } from '@adonisjs/limiter'

// ADR 0004: contadores em memória do processo (uma instância da API).
const limiterConfig = defineConfig({
  default: 'memory',
  stores: {
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
