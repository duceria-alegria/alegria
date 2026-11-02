# alegria

This project was generated with [`@vendure/create`](https://github.com/vendurehq/vendure/tree/master/packages/create).

Useful links:

- [Vendure docs](https://www.vendure.io/docs)
- [Vendure Discord community](https://www.vendure.io/community)
- [Vendure on GitHub](https://github.com/vendurehq/vendure)
- [Vendure plugin template](https://github.com/vendurehq/plugin-template)

## Directory structure

* `/src` contains the source code of your Vendure server. All your custom code and plugins should reside here.
* `/static` contains static (non-code) files such as assets (e.g. uploaded images) and email templates.

## Development

```
pnpm run dev
```

will start the Vendure server, [worker](https://www.vendure.io/docs/developer-guide/vendure-worker/) and Dashboard.

## Build

```
pnpm run build
```

will compile the TypeScript sources and build the Dashboard into the `/dist` directory.

## Production

For production, there are many possibilities which depend on your operational requirements as well as your production
hosting environment.

### APP_ENV and NODE_ENV

The `.env` file is for local development. It sets `APP_ENV=dev`, which turns on API debug mode, allows any
CORS origin and enables the EmailPlugin dev mailbox at `/mailbox`. The dev mailbox has no authentication, and in
dev mode no emails are sent. Do not deploy with `APP_ENV=dev`. In production, leave `APP_ENV` unset or set it to
`production`, set `NODE_ENV=production`, and set the other variables from `.env` in your hosting environment.

`.env` is listed in `.gitignore` and `.dockerignore`, so it is not committed and not copied into the Docker image.

Outside dev mode the EmailPlugin writes emails to `static/email/test-emails` and does not send them. Configure an
[email transport](https://docs.vendure.io/reference/core-plugins/email-plugin/) in `src/vendure-config.ts` before
you go live.

When `NODE_ENV` is `production`, Vendure refuses to start if `SUPERADMIN_PASSWORD` is the default `superadmin`.
Vendure uses `SUPERADMIN_PASSWORD` to set the password only when it creates the superadmin user. If the database
already has that user, for example because you created it in development, changing `SUPERADMIN_PASSWORD` does not
change its password. Change it in the Dashboard instead.

### CORS origins

Set the `CORS_ORIGINS` environment variable to a comma-separated list of the origins your browsers call
the API from, for example `https://example.com,https://admin.example.com`. If you leave it empty, the
server sends no `Access-Control-Allow-Origin` header and a separately hosted storefront or dashboard
gets a CORS error on every request. The dashboard served by the `DashboardPlugin` runs on the same
origin as the API, so it is not affected.

In development (`APP_ENV=dev`) any origin is allowed, so you do not need to set this locally.

### Running directly

You can run the built files directly with the `start` script:

```
pnpm run start
```

You could also consider using a process manager like [pm2](https://pm2.keymetrics.io/) to run and manage
the server & worker processes.

### Using Docker

The [Dockerfile](./Dockerfile) builds a production image (multi-stage, runs as a non-root user, production
dependencies only). The server and the worker use the same image and differ only in the command. Because
`pnpm-lock.yaml` lives at the monorepo root, the build context is the **repository root**, not `apps/server`:

```
# from the monorepo root
docker build -f apps/server/Dockerfile -t alegria-server .

# server (runs pending migrations on startup)
docker run -d -p 3000:3000 --env-file .env.production --name alegria-server alegria-server
# worker
docker run -d --env-file .env.production --name alegria-worker alegria-server node dist/index-worker.js
```

The image does not contain `.env`. Create `.env.production` with `NODE_ENV=production`, `APP_ENV=production`,
`PUBLIC_URL`, `STOREFRONT_URL`, `CORS_ORIGINS` and the `DB_*`, `COOKIE_SECRET` and `SUPERADMIN_*` values. Mount a
volume at `/app/apps/server/static/assets` so uploaded images survive container replacement.

The easy way is the production stack at the repository root, which also starts PostgreSQL, wires the volumes and
orders startup (database, then server and its migrations, then worker):

```
cp .env.prod.example .env.prod   # fill in the values
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

It publishes the server on `127.0.0.1:3001` and does not include TLS: put a reverse proxy (Caddy, Traefik, nginx)
in front of it.

### Docker Compose

We've included a [docker-compose.yml](./docker-compose.yml) file which includes configuration for commonly-used
services such as PostgreSQL, MySQL, MariaDB, Elasticsearch and Redis.

To use Docker Compose, you will need to have Docker installed on your machine. Here are installation
instructions for [Mac](https://docs.docker.com/desktop/install/mac-install/), [Windows](https://docs.docker.com/desktop/install/windows-install/),
and [Linux](https://docs.docker.com/desktop/install/linux/).

You can start the services with:

```shell
docker-compose up <service>

# examples:
docker-compose up postgres_db
docker-compose up redis
```

## Plugins

In Vendure, your custom functionality will live in [plugins](https://www.vendure.io/docs/plugins/).
These should be located in the `./src/plugins` directory.

To create a new plugin run:

```
pnpm exec vendure add
```

and select `[Plugin] Create a new Vendure plugin`.

## Migrations

[Migrations](https://www.vendure.io/docs/developer-guide/migrations/) allow safe updates to the database schema. Migrations
will be required whenever you make changes to the `customFields` config or define new entities in a plugin.

To generate a new migration, run:

```
pnpm exec vendure migrate
```

The generated migration file will be found in the `./src/migrations/` directory, and should be committed to source control.
Next time you start the server, and outstanding migrations found in that directory will be run by the `runMigrations()`
function in the [index.ts file](./src/index.ts).

If, during initial development, you do not wish to manually generate a migration on each change to customFields etc, you
can set `dbConnectionOptions.synchronize` to `true`. This will cause the database schema to get automatically updated
on each start, removing the need for migration files. Note that this is **not** recommended once you have production
data that you cannot lose.

---

You can also run any pending migrations manually, without starting the server via the "vendure migrate" command.

---

## Troubleshooting

### Error: Could not load the "sharp" module using the \[OS\]-x\[Architecture\] runtime when running Vendure server.

- Make sure your Node version is ^18.17.0 || ^20.3.0 || >=21.0.0 to support the Sharp library.
- Make sure your package manager is up to date.
- **Not recommended**: if none of the above helps to resolve the issue, install sharp specifying your machines OS and Architecture. For example: `pnpm install sharp --config.platform=linux --config.architecture=x64` or `npm install sharp --os linux --cpu x64`
