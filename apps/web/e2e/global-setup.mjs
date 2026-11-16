import { cleanup, dropSchema, ensureSchema, seed } from "./seed.mjs";

// Variáveis definidas aqui são herdadas pelos workers do Playwright
export default async function globalSetup() {
  const migrated = await ensureSchema();
  const { restaurantId, slug } = await seed();
  process.env.E2E_RESTAURANT_ID = restaurantId;
  process.env.E2E_SLUG = slug;
  return async () => {
    await cleanup(restaurantId);
    if (migrated) dropSchema();
  };
}
