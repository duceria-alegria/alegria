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
(migrations run on server startup). It does not include the storefront or TLS.

```bash
cp .env.prod.example .env.prod   # fill in the secrets and public URLs
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

- Server: `127.0.0.1:3001` by default (`SERVER_BIND` / `SERVER_PORT`). Put a reverse proxy with HTTPS in front of it
  and point `PUBLIC_URL` at the public address.
- Data lives in the `postgres_data` and `assets_data` volumes: back them up.
- Update: `git pull`, then rerun the `up -d --build` command.
- Details and plain `docker run` usage: [apps/server/README.md](./apps/server/README.md#using-docker).

### Deploy with GitHub Actions

[`.github/workflows/deploy-server.yml`](./.github/workflows/deploy-server.yml) runs on every push to `main` that
touches the server (or manually from the Actions tab). It builds the image, pushes it to
`ghcr.io/<owner>/<repo>-server` tagged with the commit SHA and `latest`, then connects to your VPS over SSH, pulls the
image and runs `docker compose up -d --wait`. The job fails if the server does not become healthy within 3 minutes.
The workflow must live at the root of the git repository (this directory).

**One-time server setup** (any Linux VPS with Docker + the Compose plugin):

```bash
# on the server, as the deploy user (must be able to run docker)
mkdir -p ~/alegria && cd ~/alegria
# create .env.prod here (see .env.prod.example); secrets stay on the server, never in GitHub
```

**One-time GitHub setup** (Settings → Secrets and variables → Actions; optionally create an Environment called
`production` to require manual approval):

| Name | Kind | Value |
| --- | --- | --- |
| `DEPLOY_HOST` | secret | VPS hostname or IP |
| `DEPLOY_USER` | secret | SSH user on the VPS |
| `DEPLOY_SSH_KEY` | secret | private key; generate a dedicated one with `ssh-keygen -t ed25519 -f deploy_key -N ""` and add `deploy_key.pub` to `~/.ssh/authorized_keys` on the VPS |
| `DEPLOY_KNOWN_HOSTS` | secret | output of `ssh-keyscan -p <port> <host>` (verified against the host on every deploy) |
| `DEPLOY_PORT` | secret, optional | SSH port, default `22` |
| `DEPLOY_PATH` | variable, optional | directory on the VPS, default `~/alegria` |

The workflow copies `docker-compose.prod.yml` to the VPS on each deploy; `.env.prod` is only read from there.

**Rollback:** every image is also tagged with its commit SHA. On the VPS run:

```bash
cd ~/alegria
SERVER_IMAGE=ghcr.io/<owner>/<repo>-server IMAGE_TAG=<old-sha> \
  docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-build --wait
```

(You need to be logged in to GHCR on the VPS for this, e.g. `docker login ghcr.io` with a token that has
`read:packages`, because the workflow's own token expires when the job ends.) Database migrations are not reverted
by a rollback.

## Learn More

- [Vendure Documentation](https://docs.vendure.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vendure Discord Community](https://vendure.io/community)
