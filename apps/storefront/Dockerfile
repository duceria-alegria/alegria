# Imagen de producción de la tienda (Next.js, salida "standalone").
#
# El contexto de build es la RAÍZ del monorepo, porque pnpm-lock.yaml y
# pnpm-workspace.yaml viven ahí:
#   docker build -f apps/storefront/Dockerfile -t alegria-storefront .
# (docker-compose.prod.yml ya lo hace por ti.)
#
# OJO: `next build` pre-renderiza páginas que consultan la Shop API, así que el backend
# debe estar arriba y accesible DURANTE el build (VENDURE_SHOP_API_URL). Por eso el compose
# construye esta imagen con `network: host` y después de levantar el server.

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@10
WORKDIR /app

# Solo los manifiestos: esta capa (y el install) se reutiliza mientras no cambien las dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/storefront/package.json apps/storefront/

# ---------------------------------------------------------------------------
FROM base AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter storefront...
COPY apps/storefront apps/storefront

# Se leen en tiempo de build: NEXT_PUBLIC_* se incrustan en el JS del navegador,
# ASSETS_URL autoriza el host de las imágenes en next/image y la API se consulta al pre-renderizar.
ARG VENDURE_SHOP_API_URL
ARG VENDURE_CHANNEL_TOKEN=__default_channel__
ARG ASSETS_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_NAME
ARG NEXT_PUBLIC_CONTACT_PHONE
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_CONTACT_ADDRESS
ARG NEXT_PUBLIC_CONTACT_HOURS
ENV VENDURE_SHOP_API_URL=$VENDURE_SHOP_API_URL \
    VENDURE_CHANNEL_TOKEN=$VENDURE_CHANNEL_TOKEN \
    ASSETS_URL=$ASSETS_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_CONTACT_PHONE=$NEXT_PUBLIC_CONTACT_PHONE \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_CONTACT_ADDRESS=$NEXT_PUBLIC_CONTACT_ADDRESS \
    NEXT_PUBLIC_CONTACT_HOURS=$NEXT_PUBLIC_CONTACT_HOURS \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter storefront build

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

# El standalone ya trae el server.js y solo las dependencias que usa (rastreadas desde la raíz del monorepo).
COPY --from=build --chown=node:node /app/apps/storefront/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=node:node /app/apps/storefront/public ./apps/storefront/public

# Next escribe su caché (imágenes optimizadas, ISR) dentro de .next.
RUN chown node:node /app/apps/storefront/.next
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD ["node", "-e", "fetch('http://localhost:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"]

CMD ["node", "apps/storefront/server.js"]
