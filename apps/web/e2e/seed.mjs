// Dados do E2E: roda SOMENTE no banco cardapio_test, só pelo `pnpm e2e` (nunca pelo `pnpm test`).
// Cria um restaurante fictício com slug aleatório e remove apenas o que ele criou. Não toca em
// nenhum dado preexistente, não roda migrations e nunca usa o cardapio_dev.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const REQUIRED_DATABASE = "cardapio_test";
const API_DIR = resolve(import.meta.dirname, "../../api");

// Mesmas fontes da API em NODE_ENV=test: .env e depois .env.test (que sobrescreve)
function readEnvFile(file) {
  const values = {};
  let content = "";
  try {
    content = readFileSync(resolve(API_DIR, file), "utf8");
  } catch {
    return values;
  }
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

export function databaseSettings() {
  const env = { ...readEnvFile(".env"), ...readEnvFile(".env.test") };
  return {
    host: env.DB_HOST ?? "127.0.0.1",
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  };
}

async function connect() {
  const settings = databaseSettings();
  if (settings.database !== REQUIRED_DATABASE) {
    throw new Error(
      `Seed do E2E recusado: o banco configurado é "${settings.database}", só "${REQUIRED_DATABASE}" é permitido.`,
    );
  }
  const client = new pg.Client(settings);
  await client.connect();
  const { rows } = await client.query("select current_database() as name");
  if (rows[0].name !== REQUIRED_DATABASE) {
    await client.end();
    throw new Error(`Seed do E2E recusado: conectado em "${rows[0].name}".`);
  }
  return client;
}

export async function withDatabase(action) {
  const client = await connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

// Valores usados pelos testes (dados fictícios, claramente identificáveis como E2E)
export const FIXTURE = {
  burgerPrice: "25.90",
  baconPrice: "4.50",
  juicePrice: "8.00",
  tableIdentifier: "e2emesa001",
};

export async function seed() {
  const slug = `e2e-${randomBytes(4).toString("hex")}`;
  return withDatabase(async (db) => {
    const restaurant = (
      await db.query(
        `insert into restaurants (name, slug, description, created_at, updated_at)
         values ($1, $2, 'Dados fictícios do teste E2E', now(), now()) returning id`,
        [`E2E Restaurante ${slug}`, slug],
      )
    ).rows[0].id;

    const category = (
      await db.query(
        `insert into categories (restaurant_id, name) values ($1, 'E2E Lanches') returning id`,
        [restaurant],
      )
    ).rows[0].id;

    const burger = (
      await db.query(
        `insert into products (restaurant_id, category_id, name, description, price, sort_order)
         values ($1, $2, 'Hambúrguer E2E', 'Produto fictício', $3, 1) returning id`,
        [restaurant, category, FIXTURE.burgerPrice],
      )
    ).rows[0].id;
    await db.query(
      `insert into products (restaurant_id, category_id, name, price, sort_order)
       values ($1, $2, 'Suco E2E', $3, 2)`,
      [restaurant, category, FIXTURE.juicePrice],
    );

    const bacon = (
      await db.query(
        `insert into product_addons (restaurant_id, name, price) values ($1, 'Bacon E2E', $2) returning id`,
        [restaurant, FIXTURE.baconPrice],
      )
    ).rows[0].id;
    await db.query(
      `insert into product_product_addons (product_id, product_addon_id, restaurant_id) values ($1, $2, $3)`,
      [burger, bacon, restaurant],
    );

    await db.query(
      `insert into restaurant_tables (restaurant_id, name, identifier) values ($1, 'Mesa E2E', $2)`,
      [restaurant, FIXTURE.tableIdentifier],
    );

    return { restaurantId: restaurant, slug };
  });
}

// Alterna a disponibilidade de um produto ou adicional do restaurante E2E (nunca de outro)
export async function setAvailable(restaurantId, kind, name, available) {
  const table = kind === "addon" ? "product_addons" : "products";
  await withDatabase((db) =>
    db.query(`update ${table} set is_available = $1 where restaurant_id = $2 and name = $3`, [
      available,
      restaurantId,
      name,
    ]),
  );
}

export async function countOrders(restaurantId) {
  return withDatabase(async (db) => {
    const { rows } = await db.query("select count(*)::int as total from orders where restaurant_id = $1", [
      restaurantId,
    ]);
    return rows[0].total;
  });
}

// Remove só o que pertence ao restaurante criado nesta execução, filhos primeiro (FKs RESTRICT)
export async function cleanup(restaurantId) {
  await withDatabase(async (db) => {
    await db.query("begin");
    try {
      for (const table of [
        "order_item_addons",
        "order_items",
        "order_status_history",
        "orders",
        "restaurant_tables",
        "product_product_addons",
        "products",
        "product_addons",
        "categories",
      ]) {
        await db.query(`delete from ${table} where restaurant_id = $1`, [restaurantId]);
      }
      await db.query("delete from restaurants where id = $1 and slug like 'e2e-%'", [restaurantId]);
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}

async function hasSchema() {
  return withDatabase(async (db) => {
    const { rows } = await db.query("select to_regclass('public.orders') as orders");
    return rows[0].orders !== null;
  });
}

// A suíte da API desfaz as migrations ao terminar, então o cardapio_test costuma estar vazio.
// Migra só se estiver vazio (sempre em NODE_ENV=test, banco validado) e desfaz no final.
export async function ensureSchema() {
  if (await hasSchema()) return false;
  runAce("migration:run", "--force", "--no-schema-generate");
  return true;
}

export function dropSchema() {
  runAce("migration:rollback", "--batch=0", "--force", "--no-schema-generate");
}

function runAce(...args) {
  if (databaseSettings().database !== REQUIRED_DATABASE) throw new Error("Migration recusada fora do cardapio_test.");
  execFileSync(process.execPath, ["ace", ...args], {
    cwd: API_DIR,
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit",
  });
}
