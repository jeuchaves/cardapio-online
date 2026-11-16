# ADR 0005 — Playwright e `pg` como dependências de desenvolvimento do E2E

- Status: aprovado — Fase 5, F5-T8
- Data: 2026-11-15
- Referências: `CLAUDE.md` seções 1, 3, 11 e 12; ADR 0001

## Contexto

O CLAUDE.md prevê Playwright apenas para o fluxo principal: abrir o cardápio, montar o carrinho, enviar o pedido e acompanhá-lo. A F5-T8 precisa verificar, no navegador, comportamentos que testes de API não alcançam: total do carrinho vindo da cotação, falha da cotação sem bloquear o envio, total do pedido criado prevalecendo sobre o cotado e reenvio com a mesma `Idempotency-Key`. O Playwright não faz parte da stack instalada e o teste precisa de dados fictícios no banco de testes.

## Decisão

- Adicionar `@playwright/test` como dependência de desenvolvimento de `apps/web`, com o Chromium baixado localmente. Só o fluxo principal é coberto; sem outros navegadores nem testes de componentes.
- Adicionar `pg` como dependência de desenvolvimento de `apps/web`, apenas para o seed do E2E (`e2e/seed.mjs`). O Lucid e a API não são usados no web.
- O E2E roda somente por `pnpm e2e`, nunca por `pnpm test`.
- O seed:
  - roda exclusivamente no banco `cardapio_test`: recusa outro nome de banco antes de conectar e confere `current_database()` depois;
  - cria só dados fictícios identificáveis (restaurante com slug `e2e-<aleatório>`, nomes terminados em "E2E");
  - nunca altera nem apaga dados preexistentes: o teardown remove apenas as linhas do restaurante criado na execução;
  - se o `cardapio_test` estiver sem tabelas (a suíte da API desfaz as migrations ao terminar), aplica as migrations e as desfaz no fim, sempre com `NODE_ENV=test` e sem gerar `schema.ts`. Nunca toca no `cardapio_dev`.
- A API do E2E sobe com `NODE_ENV=test` na porta 3401 e o Next.js de produção na porta 3400, com `distDir` próprio (`.next-e2e`). Assim o E2E não colide com o `pnpm dev` (portas 3000/3333, `.next`, `cardapio_dev`).

## Consequências

- Duas dependências de desenvolvimento novas; nada entra no bundle de produção.
- O download do Chromium (`pnpm exec playwright install chromium`) é um passo local e de CI.
- O E2E depende do PostgreSQL ativo (`docker compose up -d --wait postgres`) e das portas 3400 e 3401 livres.
- Se o teardown for interrompido, dados E2E (slug `e2e-*`) podem sobrar no `cardapio_test`; não afetam a suíte da API, que cria os próprios dados.
- O `next build` do E2E acrescenta `.next-e2e` ao `include` do `tsconfig.json` do web.
