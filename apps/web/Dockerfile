# syntax=docker/dockerfile:1
# Imagem do frontend (Next.js standalone). Contexto de build: a RAIZ do repositório.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://menubora.com.br \
#     -t cardapio-web:<tag-do-commit> .
# NEXT_PUBLIC_SITE_URL é lida no BUILD e fixa a URL dos QR Codes (ADR 0003): trocar o domínio exige
# nova imagem e invalida QR Codes impressos. O build baixa a fonte Geist (next/font/google): precisa
# de acesso à internet. Node.js 24 LTS (ADR 0006), usuário não root, sem segredos na imagem.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @cardapio/web...

FROM deps AS build
COPY apps/web apps/web
ARG NEXT_PUBLIC_SITE_URL
# O rewrite de /api no next.config.ts só vale em desenvolvimento; em produção o Nginx encaminha /api.
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    API_INTERNAL_URL=http://cardapio-api:3333
RUN test -n "$NEXT_PUBLIC_SITE_URL" || { echo "Informe --build-arg NEXT_PUBLIC_SITE_URL=https://..." >&2; exit 1; }
RUN pnpm --filter @cardapio/web build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# O standalone repete a estrutura do monorepo: o servidor fica em apps/web/server.js.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
