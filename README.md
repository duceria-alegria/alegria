# alegria

A full-stack e-commerce application built with [Vendure](https://www.vendure.io/) and [Next.js](https://nextjs.org/docs).

## Project Structure

This is a monorepo using pnpm workspaces:

```
alegria/
├── apps/
│   ├── server/       # Vendure backend (GraphQL API, Admin Dashboard)
│   └── storefront/   # Next.js frontend
└── package.json      # Root workspace configuration
```

## Getting Started

### Development

Start both the server and storefront in development mode:

```bash
pnpm run dev
```

Or run them individually:

```bash
# Start only the server
pnpm run dev:server

# Start only the storefront
pnpm run dev:storefront
```

### Access Points

- **Vendure Dashboard**: http://localhost:3001/dashboard
- **Shop GraphQL API**: http://localhost:3001/shop-api
- **Admin GraphQL API**: http://localhost:3001/admin-api
- **Storefront**: http://localhost:3002

### Admin Credentials

Use these credentials to log in to the Vendure Dashboard:

- **Username**: superadmin
- **Password**: superadmin

## Selling by box and by piece (wholesale)

A product is sold as **Pieza** and **Caja** with two variants that share an option group "Presentación":

1. In the Dashboard create the option group "Presentación" with the options "Pieza" and "Caja" and add it to the product.
2. Create one variant per option. On the **Caja** variant fill in **Piezas por caja** (2 or more): that field is what
   marks a variant as a box. Leave it empty on **Pieza**.
3. Set the retail price (the variant price) and the three wholesale prices (**Precio mayoreo 1-3**) on both variants.
   Keep the price per piece of the box (box price ÷ pieces) **lower** than the Pieza price in every list, otherwise loose
   pieces are cheaper than the box. The system does not check this.
4. Stock is separate: each variant has its own, closed boxes on one side and loose pieces on the other. When a box is
   opened, adjust both (−1 Caja, +N Pieza).

Boxes are only visible and purchasable for wholesale customers (Mayoreo 1-3). Visitors and retail customers only see
Pieza, and the Shop API refuses to add a Caja to their cart. A customer who wants 24 pieces with 20-piece boxes adds
1 Caja + 4 Piezas (two cart lines). The code lives in `apps/server/src/plugins/precios-por-lista`.

## Product search

Searching a term (the shop search box and the navbar one) ignores accents (`pina` finds `piña`), tolerates typos and
plurals (`skitles`, `gomitas`), matches spellings that sound the same in Spanish (`lukas` finds `lucas`, `sumba` finds
`zumba`: c/k/qu, z/s, v/b, y/ll/i, silent h), understands synonyms and ranks by relevance. A product is found by its name, facet
values, collections, description and SKU (a SKU is matched only when the search contains a digit, so `caja` does not
match every `-CAJA` variant). The Shop API is unchanged; the code lives in `apps/server/src/plugins/busqueda-productos`.

- **How it works:** the plugin keeps `product_search_document` (one normalized text per product and language, with
  `pg_trgm` indexes) and `BusquedaProductosStrategy` (passed to `DefaultSearchPlugin`) queries it. The table is derived
  data: it updates itself on product, variant, collection and facet changes and repairs itself when the server starts.
- **Synonyms** are in `search-text.ts` (`SYNONYM_GROUPS`) and are only an initial list; replace them with the words
  your customers use. After editing them (or anything that changes the indexed text in `search-text.ts`: normalization,
  `phoneticKey`, the synonym groups) bump `SEARCH_TEXT_VERSION`: at its next start the server rebuilds the documents
  stored with another version, **also in production**, where the ts-node scripts are not available.
  `pnpm --filter server search:reindex` forces a rebuild in development. The Dashboard's "Reindex" button rebuilds
  Vendure's own index, not this one.
- **Checking a change** (synonyms, thresholds, scoring), from `apps/server`:
  - `npm test` runs the unit tests (text normalization, query parsing, SQL builder, golden-query evaluator).
  - `npm run search:golden` runs the *golden queries* (`plugins/busqueda-productos/consultas-de-oro.ts`) against the
    Shop API (the dev server must be running; `--url` points it to another environment, `--verbose` shows the top
    results, `--only <text>` filters) and exits with 1 if one stops giving the expected products. Queries marked
    `pendiente` are known limits (e.g. `lukas` for `lucas`): they don't fail, but the report tells you when one starts
    working. When a customer can't find something, add that search there with what they expected to find.
- Without an explicit sort a term is ordered by relevance; the storefront offers it as "Relevancia".
- The shop search box (`apps/storefront/src/features/search/search-box.tsx`) searches while typing: 300 ms after the last
  key and from 2 characters (Enter searches right away). Typing uses `router.replace`, so the back button does not walk
  through partial words; Enter and the clear button add a history entry.

### What customers search (search log)

Searches are recorded in the `search_log` table to learn what customers look for, above all what they **don't find**
(searches with 0 results). Read it in the Dashboard, **Catalog → Búsquedas de clientes** ("Qué buscan los clientes":
period selector, totals, what they don't find, most searched and a split by customer type: visitor, menudeo,
mayoreo 1-3), or from the terminal with `pnpm --filter server search:terms` (`-- --days 7 --limit 50`). Both use the
same queries (`reporte-busquedas-sql.ts`) and only show aggregates, never who searched what.

- **Access:** the screen needs the `VerBusquedasClientes` permission (the superadmin already has it; give it to other
  roles in Settings → Roles). The Admin API query `reporteBusquedas` enforces it; it does not exist in the Shop API.

- **When:** only a search that *settled* (about 1.5 s unchanged on screen, or the customer left the page), not every letter
  typed. The storefront sends it with `navigator.sendBeacon` to `/api/search-log`, which calls the Shop API mutation
  `registrarBusqueda`.
- **Who:** logged-in customers are linked to their account (`customerId`); everyone else gets a random id in a first-party
  cookie (`alegria_vid`, HttpOnly, 180 days). **The IP is not stored** (it is a poor identifier, shared by many people and
  changing on phones, and more sensitive to keep). The cookie and this log should be mentioned in the privacy notice.
- **What is dropped:** searches that look like personal data (emails, phone or card numbers, URLs), a single letter,
  crawlers, repeats of the same search by the same visitor within 30 s, and more than 30 searches per visitor per minute.
- **Protection:** the mutation requires the shared secret `SEARCH_LOG_SECRET` (same value in the server and the
  storefront, header `x-search-log-key`), so nobody can fill the table from the internet. Without it nothing is
  recorded. Set it in `.env.prod`: `openssl rand -hex 24`.
- **Retention:** a daily scheduled task (`limpiar-registro-busquedas`, 03:30, worker) deletes searches older than
  `SEARCH_LOG_RETENTION_DAYS` (365 by default).
- What turns up in the zero-result list goes into synonyms (`search-text.ts`) or into
  `consultas-de-oro.ts` with what the customer expected to find.

## Production Build

Build all packages:

```bash
pnpm run build
```

Start the production server:

```bash
pnpm run start
```

## Deploy with Docker

[`docker-compose.prod.yml`](./docker-compose.prod.yml) starts the Vendure backend as PostgreSQL + server + worker
(migrations run on server startup) and the storefront (Next.js, `output: 'standalone'`). It does not include TLS.

```bash
cp .env.prod.example .env.prod   # fill in the secrets and public URLs
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build postgres server worker
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build storefront
```

The storefront goes in a second step on purpose: `next build` pre-renders pages with data from the Shop API, so the
server must be healthy **before** the storefront image is built (the build uses `network: host` to reach it on
`127.0.0.1:${SERVER_PORT}`). At runtime the storefront talks to the server over the compose network (`http://server:3000`).

- Server: `127.0.0.1:3001` by default (`SERVER_BIND` / `SERVER_PORT`). Put a reverse proxy with HTTPS in front of it
  and point `PUBLIC_URL` at the public address.
- Storefront: `127.0.0.1:3002` by default (`STOREFRONT_BIND` / `STOREFRONT_PORT`). Point your proxy at it and set
  `STOREFRONT_URL` (also used for `CORS_ORIGINS`) to its public address.
- `NEXT_PUBLIC_*` values (site name, contact details) and the image host (`PUBLIC_URL`) are baked in at build time;
  changing them requires rebuilding the storefront image (re-run the deploy).
- Data lives in the `postgres_data` and `assets_data` volumes: back them up.
- Update: `git pull`, then rerun the `up -d --build` command.
- Details and plain `docker run` usage: [apps/server/README.md](./apps/server/README.md#using-docker).

### Deploy with GitHub Actions

[`.github/workflows/deploy-cs-alegria.yml`](./.github/workflows/deploy-cs-alegria.yml) runs on every push to `main`
that touches the server (or manually from the Actions tab) on a **self-hosted runner installed on the production
machine** (labels `self-hosted`, `cs-alegria`). It builds the images there and runs `docker compose up -d --build --wait`
(backend first, then the storefront), so there is no registry and no SSH. The job fails if a service does not become
healthy within 5 minutes. It also runs when `apps/storefront/**` changes.
The workflow must live at the root of the git repository (this directory).

**One-time setup on the machine** (the user that runs the runner, `actions`, must be in the `docker` group):

```bash
sudo install -d -o actions -g actions -m 750 /opt/alegria
sudo -u actions cp .env.prod.example /opt/alegria/.env.prod   # or create it from the template in this repo
sudo -u actions nano /opt/alegria/.env.prod                   # fill in the values
sudo chmod 640 /opt/alegria/.env.prod
```

`.env.prod` lives outside the runner workspace on purpose: `actions/checkout` deletes untracked files on every run.
Secrets stay on the machine and never go through GitHub. Generate secrets with `openssl rand -base64 32`.

**Security:** a self-hosted runner executes workflow code with access to the machine. The workflow only triggers on
push to `main` and manual runs, never on `pull_request`. If the repository is public, also disable workflows for
forks (Settings → Actions → General) and require approval for outside collaborators.

**Reaching the server from a reverse proxy / Cloudflare Tunnel:** by default the server is published on
`127.0.0.1:3001`, which a proxy running in another container cannot reach. Either set `SERVER_BIND=0.0.0.0` in
`.env.prod` and point the tunnel at `http://<machine-ip>:3001` (storefront: `STOREFRONT_BIND=0.0.0.0` and port 3002), or attach the proxy container to the compose network
(`alegria-prod_default`) and target `http://server:3000` (storefront: `http://storefront:3000`). Set `PUBLIC_URL` to the public address.

**Rollback:** redeploy an older commit by re-running the workflow from that commit (Actions → the run → Re-run), or
on the machine check out the old commit and run the `up -d --build` command from above. Database migrations are not
reverted. Back up the `alegria-prod_postgres_data` and `alegria-prod_assets_data` volumes.

## Learn More

- [Vendure Documentation](https://docs.vendure.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vendure Discord Community](https://vendure.io/community)
