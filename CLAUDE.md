# CLAUDE.md — Cardápio Digital para Restaurantes de Pequeno Porte

Sistema multi-tenant de cardápio digital e pedidos simples. Este arquivo define as regras do projeto. Em caso de conflito, estas regras prevalecem.

## 1. Princípios (leia primeiro)

- Desenvolver **somente o necessário** para o escopo atual (seção 2). Na dúvida, escolher a opção mais simples.
- **Regra de dependências:** antes de adicionar uma dependência, criar uma camada ou introduzir uma tecnologia, verificar se o requisito pode ser resolvido com os recursos já existentes na stack. Preferir a solução de menor complexidade que preserve segurança e manutenção.
- Não criar abstrações, camadas, serviços, filas, jobs, cache, mecanismos de automação ou infraestrutura sem necessidade funcional comprovada.
- Evolução incremental: um módulo por vez, funcionando de ponta a ponta antes do próximo. Sem código "para o futuro".
- Prioridades, nesta ordem: segurança, legibilidade, manutenção, desempenho.
- Não ampliar o escopo por conta própria. Sugestões de evolução devem ser propostas ao usuário, não implementadas.

## 2. Escopo da v1 (MVP)

- Restaurante cadastra categorias, produtos (preço, foto, disponibilidade) e adicionais simples.
- Cardápio público por slug (`/r/:slug`), mobile-first, com QR Code.
- Pedido simples: o cliente monta o carrinho e envia; o restaurante vê e atualiza o status. Pagamento presencial (entrega, balcão ou mesa).
- Painel do restaurante com login.
- Painel de plataforma: **apenas cadastrar e administrar restaurantes**. Sem planos, assinaturas ou cobrança.

### Fora do escopo (só com necessidade comprovada, pedido do usuário e ADR curto)

Pagamento online e webhooks, planos/assinaturas/cobrança, domínios personalizados, filas/worker, Redis, Outbox, RLS, MFA, relatórios avançados, notificações externas, microsserviços, GraphQL, Kubernetes, BFF com regras próprias.

## 3. Stack

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript |
| Monorepo | pnpm workspaces (Turborepo só se o build ficar lento) |
| Frontend | Next.js (App Router), Tailwind CSS, shadcn/ui |
| Backend | AdonisJS, Lucid (único ORM), validator do Adonis |
| Banco | PostgreSQL |
| Fotos | Disco local em dev; object storage compatível com S3 em produção, só quando houver upload |
| Testes | Japa (API); Playwright apenas no fluxo principal de pedido |
| Deploy | Docker Compose (web, api, postgres) atrás de Nginx |
| Observabilidade | Logs estruturados; Sentry opcional |

- O frontend consome a API diretamente. Next.js **não** tem regras de negócio nem é fonte de verdade.
- Toda regra de negócio e persistência fica no AdonisJS.
- `packages/` só é criado quando duas apps realmente compartilharem código.

## 4. Estrutura

```
apps/web            Next.js
apps/api            AdonisJS (módulos por domínio: auth, restaurants, menu, orders)
docs/decisions      ADRs curtos
docker-compose.yml
```

Criar apenas os módulos e pastas que já tenham uso real.

## 5. Multi-tenancy (obrigatório)

- Banco e schema únicos. Toda tabela de dados de restaurante possui `restaurant_id` (tenant).
- O tenant é resolvido e validado no backend: pelo vínculo do usuário autenticado ou pelo slug em rota pública. O cliente **nunca** define o tenant livremente.
- **Não depender apenas de escopo global do model.** Em cada operação (leitura, criação, alteração, exclusão), o backend valida o restaurante e aplica explicitamente o filtro por tenant. Um helper simples pode ser usado, mas não substitui essa validação.
- Usuários se associam a restaurantes por tabela de vínculo; `users` não fica preso a um único tenant.
- Papéis mínimos: `platform_admin`, `owner`, `staff`. Novos papéis só se uma funcionalidade exigir.
- **Teste de isolamento obrigatório**, cobrindo **leitura, alteração e exclusão**: usuário do restaurante A não acessa, edita nem remove dados do restaurante B, mesmo conhecendo o ID.

## 6. Sessão, CORS e CSRF

- Antes de implementar o login, registrar em ADR curto como web e API compartilham a sessão.
- Preferir a mesma origem/site (Nginx servindo web e `/api` sob o mesmo domínio), o que evita CORS.
- Se as origens forem diferentes: CORS com allowlist explícita (nunca `*` com credenciais), `credentials: include`, cookie `Secure` com `SameSite` e domínio corretos.
- `HttpOnly` impede leitura do cookie por JavaScript, mas **não resolve CSRF nem CORS**. Rotas autenticadas por cookie que alteram estado exigem proteção CSRF (token e/ou validação de `Origin`).
- Sessão com expiração e revogação no logout. Senhas com hash forte (padrão do Adonis).

## 7. Pedidos e dinheiro

- O backend busca os produtos no banco e **recalcula todos os valores**. Nunca confiar no total enviado pelo frontend.
- O pedido guarda snapshot de nome, preço, quantidade, adicionais e total. Mudanças futuras no cardápio não alteram pedidos antigos.
- **Dinheiro:** `NUMERIC` no PostgreSQL e **biblioteca decimal** no backend para todos os cálculos monetários. **Nunca converter valores monetários para `number` em cálculos.** Valores trafegam como string decimal.
- Status do pedido como enum, com transições válidas definidas em um único lugar simples. O backend valida a transição.
- Endpoint público de criação de pedido com rate limit e validação rigorosa.

## 8. QR Code

- O QR Code identifica o restaurante (URL com slug) ou a mesa (slug + identificador da mesa).
- **A mesa não é autenticação do cliente.** Serve apenas de contexto para o pedido e não concede acesso além do cardápio e do pedido que o próprio cliente criou.
- Acompanhamento de pedido por token aleatório não adivinhável, nunca por ID sequencial.

## 9. Segurança (sempre)

- Autorização no backend em **toda** rota, com checagem de propriedade do recurso (IDOR). Esconder botões na interface não é autorização.
- Queries parametrizadas (Lucid). Nunca montar SQL por concatenação.
- Validar toda entrada no backend. Upload: validar tipo, extensão e tamanho; nomes de arquivo gerados pelo servidor, em caminho isolado por restaurante.
- Segredos apenas em variáveis de ambiente; nunca no repositório. Manter `.env.example` sem valores reais.
- Logs sem senha, token ou dado sensível.
- Registrar em log as ações administrativas críticas (cadastro/alteração de restaurantes, mudanças de papel).
- Mensagens de erro não expõem detalhes internos.

## 10. API

- REST com prefixo `/api/v1`. Grupos de rotas: `/public` (sem login), `/tenant` (restaurante autenticado), `/platform` (administração).
- Resposta de sucesso: `{ data, meta? }`. Erro: `{ code, message, details? }`.
- Documentar as rotas de forma simples (`docs/`), sem geração automática de contratos até haver necessidade.

## 11. Convenções de código

- Código simples e explícito; nomes claros; funções curtas. Comentar apenas o "porquê".
- Sem abstração antes da terceira repetição real. Sem serviços ou camadas só por padrão.
- Preferir recursos nativos do AdonisJS, Next.js e PostgreSQL a bibliotecas novas.
- Migrations pequenas e reversíveis; chaves estrangeiras e índices desde o início.
- Decisões relevantes registradas em `docs/decisions/` (ADR curto: contexto, decisão, consequência).
- Commits pequenos e focados; sem código morto, comentado ou não utilizado.

## 12. Testes e qualidade

- Obrigatórios: isolamento entre tenants (leitura, alteração, exclusão), cálculo de pedido no backend, transições de status, autenticação/autorização das rotas.
- Playwright somente para o fluxo principal: abrir cardápio, montar carrinho, enviar pedido, restaurante atualizar status.
- Antes de concluir qualquer tarefa: lint, typecheck e testes passam. Comandos (na raiz, com o PostgreSQL ativo via `docker compose up -d --wait postgres`): `pnpm lint`, `pnpm typecheck` e `pnpm test`. Detalhes de execução no `README.md`.
- Antes de produção: nenhum teste de isolamento falhando, backup do banco testado com restauração, logs sem dados sensíveis.

## 13. Ordem de execução (incremental)

1. Scaffold de web, api e postgres rodando localmente.
2. Autenticação, sessão e restaurantes, com isolamento por tenant e testes.
3. Cardápio: categorias, produtos, adicionais, fotos.
4. Cardápio público e QR Code.
5. Pedidos e painel de atendimento.
6. Deploy e backup do banco.

Não começar pelo layout do cardápio. Evoluções além disso só por pedido explícito do usuário.
