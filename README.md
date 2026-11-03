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
