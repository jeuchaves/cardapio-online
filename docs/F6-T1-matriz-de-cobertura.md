# F6-T1: matriz de cobertura de testes

Origem dos requisitos: `CLAUDE.md` seções 5 a 9 e 12; `docs/ROADMAP.md` seções 4.4, 5, 6 e 8; ADRs 0001 a 0005.
Base: commit `d130f34` mais os testes adicionados na F6-T1 (seção 8).
Suíte da API (Japa): **334 testes** (322 existentes + 7 da F6-T1 + 5 do `?mesa=`), todos passando. Os caminhos abaixo são relativos a `apps/api/tests/functional/`.

Legenda: ✅ coberto · ➕ coberto por teste novo da F6-T1 · ⚠️ divergência de contrato (seção 9) · 🔜 fora do alcance dos testes da API, verificado em outra tarefa (seção 10).

## 1. Itens obrigatórios do CLAUDE.md seção 12

| Requisito | Situação | Onde |
| --- | --- | --- |
| Isolamento entre tenants (leitura, alteração, exclusão) | ✅ ➕ | Seção 3 |
| Cálculo de pedido no backend | ✅ | Seção 5 |
| Transições de status | ✅ | Seção 5 |
| Autenticação e autorização das rotas | ✅ | Seções 2, 4 e 6 |
| Playwright: abrir cardápio, carrinho, pedido, restaurante atualiza status | ✅ | `apps/web/e2e/order-flow.spec.mjs` e `panel-orders.spec.mjs` (13 testes; F6-T2) |

## 2. ADR 0002: os 17 testes obrigatórios

| # | Requisito | Situação | Teste |
| --- | --- | --- | --- |
| 1 | Cookie com `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`; `Secure` na config de produção | ✅ ➕ | `auth.spec.ts` (`1 e 2`); `restaurant_lifecycle.spec.ts` (`Secure acompanha app.inProduction…`). Verificação real do `Secure` atrás de HTTPS: 🔜 F6-T4/T8 |
| 2 | Cookie só com o identificador; linha em `sessions` | ✅ | `auth.spec.ts` (`1 e 2`) |
| 3 | Login gera identificador novo (fixation) | ✅ | `auth.spec.ts` (`3`) |
| 4 | Inatividade acima do limite: 401 e linha removida | ✅ | `auth.spec.ts` (`4`) |
| 5 | Limite absoluto de 12 h mesmo com atividade | ✅ | `auth.spec.ts` (`5 e 6`) |
| 6 | Atividade não prorroga além do absoluto | ✅ | `auth.spec.ts` (`5 e 6`) |
| 7 | Logout apaga a sessão; cookie copiado dá 401 | ✅ | `auth.spec.ts` (`7`) |
| 8 | Troca de senha rotaciona, preserva `login_at`, revoga as outras; reset e desativação revogam | ✅ | `auth.spec.ts` (`8`); `tenant.spec.ts` (desativar e redefinir staff); `platform.spec.ts` (reset do owner, D11) |
| 9 | Vínculo desativado nega acesso com a sessão válida | ✅ | `tenant.spec.ts` (`9`) |
| 10 | `Origin` correto passa; ausente, vazio, `null` e de outro site: 403, para POST/PUT/PATCH/DELETE | ✅ | `csrf.spec.ts` (`10`) |
| 11 | Comparação exata e normalização | ✅ | `csrf.spec.ts` (`11`, duas variantes) |
| 12 | `Referer` sem `Origin` continua recusado | ✅ | `csrf.spec.ts` (`POST e PATCH com Origin inválido ou só com Referer`) |
| 13 | Login sem `Origin` válido: 403 | ✅ | `auth.spec.ts` (`13`) |
| 14 | Métodos seguros não exigem `Origin` | ✅ | `csrf.spec.ts` (`14`); `auth.spec.ts` (`14`) |
| 15 | Tabela de rotas: toda rota que altera estado tem `Origin` | ✅ | `csrf.spec.ts` (`15`) |
| 16 | `/public` não lê o cookie de sessão | ✅ | `public_menu.spec.ts` (`ADR 0002 teste 16`); `public_orders.spec.ts`; `public_cart_quote.spec.ts`; `csrf.spec.ts` (`16`) |
| 17 | Login acima de 5/min: 429 | ✅ | `auth.spec.ts` (`17`, `D3`) |

## 3. Isolamento entre restaurantes (leitura, alteração, exclusão)

| Recurso | Leitura | Alteração | Exclusão | Teste |
| --- | :-: | :-: | :-: | --- |
| Restaurante (dados e configurações) | ✅ | ✅ | ➕ (não há rota; 404/405) | `tenant.spec.ts` (`Isolamento \| A não alcança B`); `restaurant_lifecycle.spec.ts` |
| Equipe (staff) | ✅ | ✅ (ativar, desativar, reset) | ➕ (não há rota; 404/405) | `tenant.spec.ts`; `restaurant_lifecycle.spec.ts` |
| Categoria | ✅ | ✅ | ✅ | `categories.spec.ts`; `menu_isolation.spec.ts` |
| Produto | ✅ | ✅ | ✅ | `products.spec.ts`; `menu_isolation.spec.ts` |
| Adicional | ✅ | ✅ | ✅ | `addons.spec.ts`; `menu_isolation.spec.ts` |
| Associação produto × adicional | ✅ | ✅ | ✅ (via exclusão do produto) | `product_addons_link.spec.ts`; `menu_isolation.spec.ts` |
| Imagem de produto e logo | ✅ | ✅ | ✅ | `images.spec.ts` (`isolamento`); `menu_isolation.spec.ts` |
| Mesa | ✅ | ✅ | ✅ | `tables.spec.ts` (`Mesas \| isolamento`) |
| Pedido (painel) | ✅ | ✅ (todas as transições) | ✅ (não há rota) | `orders_isolation.spec.ts`; `orders_panel.spec.ts`; `orders_status.spec.ts` |
| Cardápio público | ✅ | n/a | n/a | `public_menu.spec.ts` (`isolamento`) |
| Acompanhamento por token | ✅ | n/a | n/a | `public_order_tracking.spec.ts` |
| Idempotência por restaurante | ✅ | n/a | n/a | `public_orders_idempotency.spec.ts` |

Cenários transversais, todos ✅:

- Sem vínculo, vínculo inativo e `platform_admin` recebem 404: `menu_isolation.spec.ts`, `orders_isolation.spec.ts`, `tables.spec.ts`, `tenant.spec.ts`.
- Usuário com vínculo em dois restaurantes acessa só o do vínculo correspondente: os mesmos arquivos.
- `restaurant_id` no corpo nunca define o tenant: `categories.spec.ts`, `products.spec.ts`, `addons.spec.ts`.
- Toda consulta carrega o `restaurant_id` do tenant autorizado (verificado nas queries): `menu_isolation.spec.ts`, `orders_isolation.spec.ts`, `orders_panel.spec.ts`, `tables.spec.ts`, `public_menu.spec.ts`.
- Owner e staff não cruzam a área de plataforma: `tenant.spec.ts`, `platform.spec.ts`.

## 4. Integridade no banco (ROADMAP 4.4)

| ID | Situação | Teste |
| --- | --- | --- |
| FK-01 | ✅ | `menu_schema.spec.ts` |
| FK-02, FK-03 | ✅ | `menu_schema.spec.ts` |
| FK-04 a FK-09 | ✅ | `orders_schema.spec.ts` |
| `SET NULL` (produto, adicional, mesa) preserva `restaurant_id` e snapshot | ✅ | `orders_schema.spec.ts` |
| CT-01 (número único por restaurante) | ✅ | `orders_schema.spec.ts` |
| CT-02 (chave de idempotência única por restaurante) | ✅ | `orders_schema.spec.ts` |
| CT-03 (telefone em `pickup`) | ✅ | `orders_schema.spec.ts` |
| CT-04 (mesa por modalidade) | ✅ | `orders_schema.spec.ts` |
| CT-05 (modalidade e pagamento habilitados) | ✅ | `schema.spec.ts` |
| CT-06 (quantidade e valores) | ✅ | `menu_schema.spec.ts`, `orders_schema.spec.ts` |
| `UNIQUE (id, restaurant_id)`, `RESTRICT`, limites de texto, e-mail único sem caixa, slug | ✅ | `schema.spec.ts`, `menu_schema.spec.ts`, `orders_schema.spec.ts`, `tables.spec.ts` |
| Tabela `sessions` com as colunas do driver | ✅ | `schema.spec.ts` |

## 5. Pedidos e dinheiro

| Requisito | Situação | Teste |
| --- | --- | --- |
| Recalculo no backend; total do cliente ignorado; campo monetário rejeitado | ✅ | `public_orders.spec.ts`; `public_cart_quote.spec.ts` |
| Adicional por unidade; soma sem erro de ponto flutuante; strings com 2 casas | ✅ | `public_orders.spec.ts`; `public_cart_quote.spec.ts`; `products.spec.ts` |
| Preço de entrada: só string decimal, até 8 inteiros e 2 casas (ADR 0001) | ✅ | `products.spec.ts`; `addons.spec.ts` |
| Preço do catálogo no momento do pedido; cotação seguida de mudança de preço | ✅ | `public_orders.spec.ts`; `public_cart_quote.spec.ts` |
| Cotação igual ao pedido e sem rastro no banco | ✅ | `public_cart_quote.spec.ts` |
| Snapshots imutáveis (produto, adicional, mesa alterados ou excluídos) | ✅ | `orders_panel.spec.ts`; `orders_schema.spec.ts`; `public_order_tracking.spec.ts` |
| Item, adicional, modalidade, pagamento, telefone e mesa inválidos | ✅ | `public_orders.spec.ts` |
| Rollback: nunca existe pedido parcial | ✅ | `public_orders.spec.ts` (`falha após o número ser reservado…`) |
| Idempotência: replay, conflito, hash, isolamento, concorrência real | ✅ | `public_orders_idempotency.spec.ts` |
| Numeração: sequencial, sem lacuna por falha, independente entre restaurantes, concorrente | ✅ | `public_orders_idempotency.spec.ts` |
| Transições: tabela de 7 transições, matriz 6×6, cancelamento até `preparing`, estados finais | ✅ | `orders_status.spec.ts` |
| Histórico na mesma transação; rollback; concorrência | ✅ | `orders_status.spec.ts` |
| Cliente não cancela nem altera: não existe rota pública | ✅ | `orders_status.spec.ts`; `orders_isolation.spec.ts` |
| Restaurante inativo: público para de receber, painel continua operando pedidos existentes | ➕ | `restaurant_lifecycle.spec.ts` |

## 6. Permissões `owner` e `staff` (ROADMAP 5.1)

| Operação | Situação | Teste |
| --- | --- | --- |
| Consultar e alterar status de pedidos (ambos) | ✅ | `orders_panel.spec.ts`; `orders_status.spec.ts` |
| Criar e editar categorias, produtos e adicionais (ambos) | ✅ | `categories.spec.ts`; `products.spec.ts`; `addons.spec.ts` |
| Excluir, `is_active` e `is_available`: só owner (staff recebe 403, mesmo com valor igual) | ✅ | `categories.spec.ts`; `products.spec.ts`; `addons.spec.ts`; `availability.spec.ts` |
| Imagem de produto: staff envia; remover e logo só owner | ✅ | `images.spec.ts` |
| Equipe, configurações do restaurante e mesas: só owner | ✅ | `tenant.spec.ts`; `tables.spec.ts` |
| `platform_admin` sem acesso a pedidos | ✅ | `orders_isolation.spec.ts`; `orders_panel.spec.ts` |
| Senha temporária pendente bloqueia tudo, exceto troca e logout | ✅ | `auth.spec.ts`; `csrf.spec.ts`; `orders_panel.spec.ts` |
| Toda rota de `/platform` e `/tenant` exige autenticação | ✅ | `csrf.spec.ts` (`toda rota de /platform e /tenant…`) |
| Plataforma: owner e staff recebem 403, sem sessão 401 | ✅ | `platform.spec.ts` |

## 7. Dados pessoais, logs e cabeçalhos

| Requisito | Situação | Teste |
| --- | --- | --- |
| Logs sem token, telefone, nome, observações, senha, payload | ✅ | `log_redaction.spec.ts` |
| Erro bruto do banco não chega ao log; redact do Pino na config real | ✅ | `log_redaction.spec.ts` |
| Auditoria só com ator, ação e recurso: pedido, cadastro de restaurante | ✅ | `orders_status.spec.ts`; `platform.spec.ts` |
| Auditoria das demais ações administrativas (edição, ativação, reset, equipe, configurações, logo, vínculo) | ➕ | `audit_log.spec.ts` |
| Ações recusadas ou inválidas não geram auditoria | ➕ | `audit_log.spec.ts` |
| Acompanhamento: resposta mínima, 404 uniforme, `no-store` e `no-referrer` | ✅ | `public_order_tracking.spec.ts` |
| Senha temporária exibida uma vez, `no-store`, nunca em log | ✅ | `platform.spec.ts`; `tenant.spec.ts` |
| Listagem de equipe sem hash nem senha | ✅ | `tenant.spec.ts` |
| Imagens: tipo pelo conteúdo, 5 MB, nome do servidor, `nosniff`, sem traversal | ✅ | `images.spec.ts` |
| Rate limit: login, troca de senha, pedido (5/min), cotação (30/min), acompanhamento (30/min) | ✅ | `auth.spec.ts`; `public_orders.spec.ts`; `public_cart_quote.spec.ts`; `public_order_tracking.spec.ts` |
| Erro 5xx genérico, sem detalhe interno; `/health` 503 sem detalhes | ✅ | `health.spec.ts`; `platform.spec.ts`; `orders_status.spec.ts` |

## 8. Lacunas reais encontradas e testes adicionados

Total: 7 testes em 2 arquivos novos, sem alterar nenhum código de produção.

| # | Lacuna | Requisito | Teste novo |
| --- | --- | --- | --- |
| 1 | Só 3 das 14 ações auditadas (`order.status_changed`, `restaurant.create`, `user.create_owner`) tinham o log verificado | CLAUDE.md seção 9; ROADMAP seção 6 | `audit_log.spec.ts`: plataforma (cadastro, vínculo, edição, ativar, desativar, reset) e tenant (dados, configurações, logo, criar, desativar, ativar e redefinir staff): exatamente um log por ação, só as 5 chaves permitidas, nenhuma senha, e-mail, nome ou telefone |
| 2 | Nenhum teste de que ação recusada, inválida ou de outro restaurante não gera auditoria | idem | `audit_log.spec.ts` (2 testes) |
| 3 | Restaurante inativo: o painel continuar operando pedidos existentes não era testado | ROADMAP 5.1 | `restaurant_lifecycle.spec.ts`: lista, detalhe e transição por owner e staff, cardápio 404, pedido novo 404, acompanhamento 200 |
| 4 | Exclusão de restaurante e de equipe: a ausência de rota não era testada (só a de pedidos) | CLAUDE.md seção 5 (exclusão) | `restaurant_lifecycle.spec.ts`: 7 tentativas de DELETE e PUT por admin e owner, próprio e de outro restaurante, respondem 404 ou 405 e as contagens não mudam |
| 5 | Atributos do cookie ligados a `app.inProduction` | ADR 0002, teste 1 | `restaurant_lifecycle.spec.ts`: o `Secure` acompanha o ambiente; `HttpOnly`, `SameSite=Lax`, `Path=/` e sem `Domain` fixos, na sessão e no cookie HTTP |

Distribuição: `audit_log.spec.ts` tem 4 testes (plataforma: ações e recusas; restaurante e equipe: ações e recusas) e `restaurant_lifecycle.spec.ts` tem 3 (restaurante inativo, ausência de rotas de exclusão, atributos do cookie).

## 9. Divergência de contrato encontrada (corrigida em tarefa separada)

**`GET /public/restaurants/:slug?mesa=` não estava implementado.** O ROADMAP 8.4 prevê o parâmetro: se o identificador for válido, ativo e a modalidade `dine_in` estiver habilitada, a resposta traz `table: { name }`.

- Situação encontrada na F6-T1: o controller ignorava o parâmetro, e o cliente só descobria uma mesa inválida ao enviar o pedido. Não havia vazamento entre restaurantes.
- Correção: `PublicMenuController` passou a tratar `?mesa=`. O formato é validado antes da consulta (10 caracteres `a-z0-9`); a consulta filtra por `restaurant_id` e `is_active`. Qualquer outro caso (ausente, malformado, repetido, inexistente, inativa, de outro restaurante ou `dine_in` desabilitado) responde 200 sem `table`, idêntico entre si, sem oráculo.
- Cobertura ✅: 5 testes em `public_menu.spec.ts` (grupo `Cardápio público | ?mesa=`).
- Fora desta correção: o frontend ainda não exibe o nome da mesa; ele continua enviando `table_identifier` na criação do pedido, onde a API valida.

## 10. Fora do alcance dos testes da API

| Item | Onde será verificado |
| --- | --- |
| `Secure` do cookie e sessão atrás de HTTPS e proxy | F6-T4 e F6-T8 (homologação) |
| IP real por trás do Nginx (`trustProxy`) e rate limit por IP | F6-T4 |
| Redação de token no `access_log` e no `error_log` do Nginx | F6-T4 (obrigatório antes da produção) |
| Headers de segurança do Nginx | F6-T4 |
| Driver S3 e imagens em produção (adendo do ADR 0003: não validado) | F6-T4 (decisão D2) |
| Rate limit em memória com mais de uma instância | Documentado na F6-T7 (uma instância) |
| Backup e restauração | F6-T5 |
| Anonimização e retenção | F6-T6 (depende do ABERTO-01) |
