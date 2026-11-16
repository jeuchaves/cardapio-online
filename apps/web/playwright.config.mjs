import { defineConfig, devices } from "@playwright/test";

// Fluxo principal de pedido (CLAUDE.md §12). Sobe uma API própria em NODE_ENV=test (banco
// cardapio_test, porta 3401) e um Next.js de produção próprio (porta 3400, .next-e2e), sem
// interferir no `pnpm dev` do desenvolvedor (portas 3000/3333, .next e cardapio_dev).
const WEB_PORT = 3400;
const API_PORT = 3401;
const apiUrl = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  globalSetup: "./e2e/global-setup.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ace serve",
      cwd: "../api",
      // Por porta: um slug inexistente responde 404, que o Playwright não aceita como "pronto"
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      // APP_URL só aqui: o Origin do navegador (127.0.0.1:3400) precisa casar com ele (ADR 0002)
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        APP_URL: `http://127.0.0.1:${WEB_PORT}`,
      },
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${WEB_PORT} -H 127.0.0.1`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { NEXT_DIST_DIR: ".next-e2e", API_INTERNAL_URL: apiUrl },
    },
  ],
});
