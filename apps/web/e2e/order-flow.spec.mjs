import { expect, test } from "@playwright/test";
import { FIXTURE, countOrders, setAvailable } from "./seed.mjs";

const slug = process.env.E2E_SLUG;
const restaurantId = process.env.E2E_RESTAURANT_ID;
const QUOTE = "**/api/v1/public/restaurants/*/cart/quote";
const ORDERS = "**/api/v1/public/restaurants/*/orders";

// Dois hambúrgueres com bacon: (25,90 + 4,50) × 2. A soma só existe neste teste, como expectativa.
const EXPECTED_TOTAL = "R$ 60,80";

async function addBurgerWithBacon(page) {
  await page.goto(`/r/${slug}?mesa=${FIXTURE.tableIdentifier}`);
  await page.getByRole("button", { name: /Hambúrguer E2E/ }).click();
  await page.getByRole("checkbox", { name: /Bacon E2E/ }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.getByRole("link", { name: "Ver carrinho (2)" }).click();
  await expect(page).toHaveURL(new RegExp(`/r/${slug}/carrinho`));
}

async function sendOrder(page) {
  await page.getByLabel("Nome").fill("Cliente E2E");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
}

test("monta o carrinho, mostra o total cotado e acompanha o pedido", async ({ page, baseURL }) => {
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL) && !request.url().startsWith("data:")) {
      external.push(request.url());
    }
  });

  await addBurgerWithBacon(page);
  await expect(page.getByTestId("cart-total")).toHaveText(EXPECTED_TOTAL);
  await expect(page.getByLabel(/Consumo no local/)).toBeChecked();

  await sendOrder(page);
  await expect(page).toHaveURL(new RegExp(`/r/${slug}/pedido/[A-Za-z0-9_-]{43}$`));
  await expect(page.getByTestId("order-total")).toHaveText(EXPECTED_TOTAL);
  await expect(page.getByTestId("order-number")).toContainText("Pedido #");
  await expect(page.getByTestId("order-status")).toHaveText("Recebido");

  // O carrinho é esvaziado e o token não é guardado em nenhum storage
  const token = new URL(page.url()).pathname.split("/").pop();
  const stored = await page.evaluate(() =>
    JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]),
  );
  expect(stored).not.toContain(token);
  expect(await page.evaluate((key) => localStorage.getItem(key), `cardapio:carrinho:${slug}`)).toContain(
    '"lines":[]',
  );

  // Sem Referer, sem cache e sem indexação na página de acompanhamento
  const response = await page.reload();
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(external).toEqual([]);
});

test("a cotação que falha não impede o envio", async ({ page }) => {
  await page.route(QUOTE, (route) => route.abort());
  await addBurgerWithBacon(page);
  await expect(page.getByTestId("cart-total-pending")).toHaveText("Indisponível agora");

  await sendOrder(page);
  await expect(page.getByTestId("order-total")).toHaveText(EXPECTED_TOTAL);
});

test("o total do pedido criado prevalece sobre o total cotado", async ({ page }) => {
  await page.route(QUOTE, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { data: { ...body.data, total: "1.00" } } });
  });
  await addBurgerWithBacon(page);
  await expect(page.getByTestId("cart-total")).toHaveText("R$ 1,00");

  await sendOrder(page);
  await expect(page.getByTestId("order-total")).toHaveText(EXPECTED_TOTAL);
});

test("reenviar o mesmo pedido reutiliza a chave e não duplica", async ({ page }) => {
  const before = await countOrders(restaurantId);
  const keys = [];
  let calls = 0;
  await page.route(ORDERS, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    calls += 1;
    if (calls === 1) {
      // O servidor cria o pedido, mas a resposta se perde: o cliente vê uma falha de rede
      await route.fetch();
      return route.abort();
    }
    return route.continue();
  });
  await addBurgerWithBacon(page);

  await sendOrder(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/r/${slug}/pedido/`));

  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(keys[1]).toBe(keys[0]);
  expect(await countOrders(restaurantId)).toBe(before + 1);
  await expect(page.getByTestId("order-total")).toHaveText(EXPECTED_TOTAL);
});

test("sem QR da mesa só há retirada, que exige telefone", async ({ page }) => {
  await page.goto(`/r/${slug}`);
  await page.getByRole("button", { name: /Suco E2E/ }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.getByRole("link", { name: "Ver carrinho (1)" }).click();

  await expect(page.getByLabel(/Consumo no local/)).toBeDisabled();
  await expect(page.getByLabel(/Retirada/)).toBeChecked();
  await expect(page.getByLabel("Telefone")).toHaveAttribute("required", "");
});

async function addJuice(page) {
  await page.getByRole("button", { name: /Suco E2E/ }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
}

test("produto indisponível: identifica o item, permite remover e enviar", async ({ page }) => {
  await page.route(QUOTE, (route) => route.abort());
  await addBurgerWithBacon(page);
  await page.goto(`/r/${slug}?mesa=${FIXTURE.tableIdentifier}`);
  await addJuice(page);
  await page.getByRole("link", { name: "Ver carrinho (3)" }).click();

  await setAvailable(restaurantId, "product", "Suco E2E", false);
  try {
    await page.getByLabel("Nome").fill("Cliente E2E");
    await page.getByRole("button", { name: "Enviar pedido" }).click();

    // Resposta real da API: 422 com details { product_ids, addon_ids }
    await expect(page.locator("form [role=alert]")).toContainText("Suco E2E");
    await expect(page.locator("form [role=alert]")).not.toContainText("Hambúrguer");
    await expect(page.locator("[data-unavailable]")).toHaveCount(1);
    await expect(page.locator("[data-unavailable]")).toContainText("Suco E2E");

    await page.getByRole("button", { name: "Remover Suco E2E" }).click();
    await expect(page.locator("[data-unavailable]")).toHaveCount(0);
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page.getByTestId("order-total")).toHaveText(EXPECTED_TOTAL);
  } finally {
    await setAvailable(restaurantId, "product", "Suco E2E", true);
  }
});

test("adicional indisponível: identifica o item afetado", async ({ page }) => {
  await page.route(QUOTE, (route) => route.abort());
  await addBurgerWithBacon(page);
  await setAvailable(restaurantId, "addon", "Bacon E2E", false);
  try {
    await sendOrder(page);
    await expect(page.locator("form [role=alert]")).toContainText("Hambúrguer E2E");
    await expect(page.locator("[data-unavailable]")).toHaveCount(1);
  } finally {
    await setAvailable(restaurantId, "addon", "Bacon E2E", true);
  }
});

test("a cotação também identifica o item indisponível", async ({ page }) => {
  await addBurgerWithBacon(page);
  await setAvailable(restaurantId, "product", "Hambúrguer E2E", false);
  try {
    await page.reload();
    await expect(page.locator("[data-unavailable]")).toContainText("Hambúrguer E2E");
  } finally {
    await setAvailable(restaurantId, "product", "Hambúrguer E2E", true);
  }
});

test("as respostas não anunciam a tecnologia no X-Powered-By", async ({ request }) => {
  // Página pública, página de login e rota inexistente (a resposta de erro também passa pelo Next)
  for (const path of [`/r/${slug}`, "/entrar", "/rota-que-nao-existe"]) {
    const response = await request.get(path);
    expect(response.headers()["x-powered-by"], path).toBeUndefined();
  }
});
