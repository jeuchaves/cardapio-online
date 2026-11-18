# syntax=docker/dockerfile:1
# Imagem da API (AdonisJS). Contexto de build: a RAIZ do repositório.
#   docker build -f apps/api/Dockerfile -t cardapio-api:<tag-do-commit> .
# Node.js 24 LTS (ADR 0006). Usuário não root. A imagem não contém segredos: tudo vem de variáveis
# de ambiente em tempo de execução. Migrations NÃO rodam ao iniciar: são um passo explícito do deploy
# (serviço "migrate" do docker-compose.prod.yml).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
WORKDIR /repo

# Manifestos do workspace: o lockfile exige todos os projetos, mesmo instalando só a API.
FROM base AS manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

FROM manifests AS deps-all
RUN pnpm install --frozen-lockfile --filter @cardapio/api...

FROM deps-all AS build
COPY apps/api apps/api
RUN pnpm --filter @cardapio/api build

# Só as dependências de produção entram na imagem final.
FROM manifests AS deps-prod
RUN pnpm install --frozen-lockfile --prod --filter @cardapio/api...

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=deps-prod /repo/node_modules ./node_modules
COPY --from=deps-prod /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/build ./apps/api/build
# Pasta temporária dos uploads (config/bodyparser.ts) precisa ser gravável pelo usuário não root.
RUN mkdir -p apps/api/build/tmp && chown -R node:node apps/api/build/tmp
USER node
WORKDIR /repo/apps/api/build
EXPOSE 3333
CMD ["node", "bin/server.js"]
