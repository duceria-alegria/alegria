# Imagen de producción del backend Vendure (server + worker comparten imagen).
#
# El contexto de build es la RAÍZ del monorepo, porque pnpm-lock.yaml y
# pnpm-workspace.yaml viven ahí:
#   docker build -f apps/server/Dockerfile -t alegria-server .
# (docker-compose.prod.yml ya lo hace por ti.)

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@10
WORKDIR /app

# Solo los manifiestos: esta capa (y el install) se reutiliza mientras no cambien las dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/

# ---------------------------------------------------------------------------
# Dependencias completas + compilación (server, worker y Dashboard).
FROM base AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter server...
COPY apps/server apps/server
RUN pnpm --filter server build

# ---------------------------------------------------------------------------
# Solo dependencias de producción (sin vite, typescript, @vendure/cli, ...).
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter server...

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/server

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json
COPY --from=build /app/apps/server/static/email/templates ./static/email/templates

# static/assets guarda las imágenes subidas: móntalo como volumen (ver docker-compose.prod.yml).
# Se crea aquí con dueño `node` para que un volumen nuevo herede esos permisos.
RUN mkdir -p static/assets static/email/test-emails \
    && chown -R node:node static
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD ["node", "-e", "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Server. El worker usa el mismo image con: node dist/index-worker.js
CMD ["node", "dist/index.js"]
