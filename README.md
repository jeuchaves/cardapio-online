# Cardápio Digital

Sistema multi-tenant de cardápio digital e pedidos simples para restaurantes de pequeno porte. As regras do projeto estão em [CLAUDE.md](CLAUDE.md); o plano, em [docs/ROADMAP.md](docs/ROADMAP.md); as decisões, em [docs/decisions/](docs/decisions/).

## Pré-requisitos

- Node.js 24 ou superior
- pnpm 9.10 (`corepack enable` usa a versão do `package.json`)
- Docker com Compose (para o PostgreSQL)

## Primeira execução

```bash
pnpm install

# Variáveis de ambiente (os .env não são versionados)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edite os arquivos copiados:

- Troque `troque-esta-senha` por uma senha local, a **mesma** em `.env` (`POSTGRES_PASSWORD`) e em `apps/api/.env` (`DB_PASSWORD`).
- Gere o `APP_KEY` da API com `node ace generate:key` dentro de `apps/api` (o comando grava a chave no `apps/api/.env`).
- Se a porta 5432 já estiver em uso, mude `POSTGRES_PORT` no `.env` e `DB_PORT` em `apps/api/.env` para o mesmo valor (por exemplo, 5433).

```bash
docker compose up -d --wait postgres   # PostgreSQL 17 (o projeto exige 15 ou superior)
pnpm dev:api                           # API em http://localhost:3333
pnpm dev:web                           # Web em http://localhost:3000
```

Verificação: abra http://localhost:3000 (deve mostrar "API disponível") ou rode `curl http://localhost:3000/api/v1/health`, que responde `{"data":{"status":"ok"}}`. Sem banco, a resposta é `503`.

O banco de testes (`cardapio_test`) é criado só na primeira inicialização do volume. Se o volume já existia, crie-o com:

```bash
docker compose exec postgres psql -U cardapio -d cardapio_dev -c "CREATE DATABASE cardapio_test"
```

## Login e administrador da plataforma (Fase 2)

Com o Postgres ativo, em `apps/api`:

```bash
node ace migration:run          # cria users, restaurants, restaurant_users e sessions
node ace create:platform-admin  # pede nome, e-mail e senha (10 a 128 caracteres)
```

- `APP_URL` em `apps/api/.env` deve ser exatamente `http://localhost:3000` (origem do navegador; é validada contra o cabeçalho `Origin` nas requisições que alteram estado). Variáveis opcionais de sessão e rate limit estão comentadas no `.env.example` (ver ADR 0002 e 0004).
- O restaurante é cadastrado pelo administrador em `/plataforma/restaurantes`; a senha temporária do dono aparece **uma única vez** e o primeiro login exige trocá-la.

### Verificação manual guiada do login (D9)

1. Abra http://localhost:3000/entrar e entre como administrador: deve ir para `/plataforma/restaurantes`.
2. Cadastre um restaurante (slug e dono); copie a senha temporária exibida.
3. Saia, entre como o dono com a senha temporária: deve ser levado a `/conta/senha`; troque a senha e confirme que cai em `/painel`.
4. Em `/painel/<id>/equipe`, crie um atendente e entre com ele: não deve ver Equipe nem alterar configurações.
5. Erre a senha 6 vezes seguidas com o mesmo e-mail: a 6ª tentativa deve responder "muitas tentativas" (429).
6. Saia e use o botão Voltar: o painel não deve reaparecer com dados (a sessão foi revogada).

## Comandos

Na raiz:

| Comando | O que faz |
| --- | --- |
| `pnpm lint` | ESLint nas duas apps |
| `pnpm typecheck` | TypeScript nas duas apps |
| `pnpm test` | Testes da API (Japa); exige o PostgreSQL ativo |
| `pnpm build` | Build das duas apps |
| `pnpm format` | Prettier na API |

## Estrutura

```
apps/api     AdonisJS (API REST em /api/v1)
apps/web     Next.js (App Router, Tailwind, shadcn/ui)
docs/        ROADMAP e decisões (ADRs)
```

O navegador usa sempre a mesma origem: o Next.js encaminha `/api/*` para a API (em produção, o Nginx fará isso). Por isso não há CORS.
