import { randomUUID } from "node:crypto";
import { devices, expect, test } from "@playwright/test";
import { FIXTURE, forceStatus } from "./seed.mjs";

const slug = process.env.E2E_SLUG;
const restaurantId = process.env.E2E_RESTAURANT_ID;
const panel = `/painel/${restaurantId}/pedidos`;

let ownerState;
let staffState;

// O login tem limite por IP e e-mail: um login por perfil, reaproveitado pelos testes
async function login(browser, baseURL, email) {
  const context = await browser.newContext({ baseURL, ...devices["Pixel 7"] });
  const page = await context.newPage();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/painel\//);
  const state = await context.storageState();
  await context.close();
  return state;
}

test.beforeAll(async ({ browser, baseURL }) => {
  ownerState = await login(browser, baseURL, process.env.E2E_OWNER_EMAIL);
  staffState = await login(browser, baseURL, process.env.E2E_STAFF_EMAIL);
});

async function openPanel(browser, baseURL, state) {
  const context = await browser.newContext({ baseURL, storageState: state, ...devices["Pixel 7"] });
  return context.newPage();
}

// Pedido do cliente criado pela API pública (a tela do cliente já é coberta em order-flow)
async function createOrder(request) {
  const menu = await (await request.get(`/api/v1/public/restaurants/${slug}`)).json();
  const product = menu.data.categories[0].products.find((item) => item.name === "Suco E2E");
  const response = await request.post(`/api/v1/public/restaurants/${slug}/orders`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      customer: { name: "Cliente Painel E2E", phone: "11999990000" },
      fulfillment_type: "dine_in",
      payment_method: "cash",
      table_identifier: FIXTURE.tableIdentifier,
      items: [{ product_id: product.id, quantity: 1, addon_ids: [] }],
    },
  });
  expect(response.status()).toBe(201);
  const { order_number, tracking_token } = (await response.json()).data;
  return { number: order_number, token: tracking_token };
}

async function customerStatus(browser, baseURL, token) {
  const context = await browser.newContext({ baseURL, ...devices["Pixel 7"] });
  const page = await context.newPage();
  await page.goto(`/r/${slug}/pedido/${token}`);
  const text = await page.getByTestId("order-status").textContent();
  await context.close();
  return text;
}

const ACTIONS = /^(Confirmar pedido|Iniciar preparo|Marcar como pronto|Concluir pedido|Cancelar pedido)$/;

test("o restaurante avança o pedido e o cliente vê cada status no acompanhamento", async ({
  browser,
  baseURL,
  request,
}) => {
  const order = await createOrder(request);
  const page = await openPanel(browser, baseURL, ownerState);

  await page.goto(panel);
  await page.getByRole("link", { name: new RegExp(`Pedido #${order.number}`) }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Recebido");
  await expect(page.getByText("11999990000")).toBeVisible();
  await expect(page.getByTestId("order-total")).toHaveText("R$ 8,00");

  const steps = [
    ["Confirmar pedido", "Confirmado"],
    ["Iniciar preparo", "Em preparo"],
    ["Marcar como pronto", "Pronto"],
    ["Concluir pedido", "Concluído"],
  ];
  for (const [button, label] of steps) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByTestId("order-status")).toHaveText(label);
    expect(await customerStatus(browser, baseURL, order.token)).toBe(label);
  }

  // Estado final: sem botões de ação e com o histórico completo
  await expect(page.getByRole("button", { name: ACTIONS })).toHaveCount(0);
  await expect(page.getByText("Pronto → Concluído")).toBeVisible();
  await page.context().close();
});

test("cancelar pede confirmação e o cliente vê o cancelamento", async ({ browser, baseURL, request }) => {
  const order = await createOrder(request);
  const page = await openPanel(browser, baseURL, ownerState);
  await page.goto(`${panel}`);
  await page.getByRole("link", { name: new RegExp(`Pedido #${order.number}`) }).click();

  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Recebido"); // nada mudou ainda
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar pedido" }).click();

  await expect(page.getByTestId("order-status")).toHaveText("Cancelado");
  expect(await customerStatus(browser, baseURL, order.token)).toBe("Cancelado");
  await expect(page.getByRole("button", { name: ACTIONS })).toHaveCount(0);
  await page.context().close();
});

test("status alterado em outro lugar: mostra o conflito e recarrega o pedido", async ({
  browser,
  baseURL,
  request,
}) => {
  const order = await createOrder(request);
  const page = await openPanel(browser, baseURL, ownerState);
  await page.goto(panel);
  await page.getByRole("link", { name: new RegExp(`Pedido #${order.number}`) }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Recebido");

  await forceStatus(restaurantId, order.number, "confirmed");
  await page.getByRole("button", { name: "Confirmar pedido" }).click(); // 409 INVALID_TRANSITION

  await expect(page.locator("[role=alert]", { hasText: "O status deste pedido mudou" })).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("Confirmado");
  await expect(page.getByRole("button", { name: "Iniciar preparo" })).toBeVisible();
  await page.context().close();
});

test("o staff também atualiza o status", async ({ browser, baseURL, request }) => {
  const order = await createOrder(request);
  const page = await openPanel(browser, baseURL, staffState);
  await page.goto(panel);
  await page.getByRole("link", { name: new RegExp(`Pedido #${order.number}`) }).click();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();

  await expect(page.getByTestId("order-status")).toHaveText("Confirmado");
  expect(await customerStatus(browser, baseURL, order.token)).toBe("Confirmado");
  await page.context().close();
});

test("a lista filtra por status", async ({ browser, baseURL, request }) => {
  const order = await createOrder(request);
  const page = await openPanel(browser, baseURL, ownerState);
  await page.goto(panel);
  const link = page.getByRole("link", { name: new RegExp(`Pedido #${order.number}`) });

  await page.getByLabel("Status").selectOption("pending");
  await expect(link).toBeVisible();
  await page.getByLabel("Status").selectOption("cancelled");
  await expect(link).toHaveCount(0);
  await page.context().close();
});
