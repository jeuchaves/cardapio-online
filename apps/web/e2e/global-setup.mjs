import { cleanup, dropSchema, ensureSchema, seed } from "./seed.mjs";

// Variáveis definidas aqui são herdadas pelos workers do Playwright
export default async function globalSetup() {
  const migrated = await ensureSchema();
  const { restaurantId, slug, password, users } = await seed();
  process.env.E2E_RESTAURANT_ID = restaurantId;
  process.env.E2E_SLUG = slug;
  process.env.E2E_PASSWORD = password;
  process.env.E2E_OWNER_EMAIL = users.owner;
  process.env.E2E_STAFF_EMAIL = users.staff;
  return async () => {
    await cleanup(restaurantId);
    if (migrated) dropSchema();
  };
}
