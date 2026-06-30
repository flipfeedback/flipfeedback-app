# flipfeedback-app

The FlipFeedback SaaS application: a feedback inbox with triage and analytics.

The product is a React SPA (`app.flipfeedback.com`) that talks only to a REST API
(`api.flipfeedback.com`), backed by PostgreSQL. Customers are businesses that collect,
triage, and understand feedback from their campaigns, channels, and customers.

## Layout

```
flipfeedback-app/
  api/          Node + Express + TypeScript REST API, Prisma ORM, PostgreSQL
    prisma/     schema.prisma, migrations, and the seed entrypoint
    src/        routes, middleware, lib
  web/          React + Vite + TypeScript SPA
    src/        pages (auth, inbox, triage, analytics, settings), components, api client
  docker-compose.yml   web + api + postgres for local runs
  .github/workflows/   CI: lint, typecheck, test, build, image build
```

## Features

- **Auth** — register (creates an organization + first owner), sign in, JWT sessions, a
  password-reset stub.
- **Inbox** — feedback items with source (campaign / channel / customer), message,
  timestamp, sentiment, and status; filter by status, sentiment, source, and free text.
- **Triage** — a board by status (New / In review / Resolved) with assignment and labels.
- **Analytics** — volume over time, breakdown by source and campaign, sentiment mix, status
  mix, and a simple first-half-vs-second-half trend.
- **Settings** — connected sources, labels, and team members.

Multi-tenant: every record is scoped to an `Organization`, and the API filters every query
by the authenticated user's organization.

## Run locally with Docker (recommended)

Requires Docker with Compose v2.

```bash
# from the repo root
export JWT_SECRET="$(openssl rand -hex 32)"   # any long random value
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:4000 (health at `/health`)
- Postgres: localhost:5432 (override the host port with `POSTGRES_HOST_PORT` if it is taken)

The API container applies Prisma migrations on boot. To load demo data, seed once the stack
is up (the seed runs from the host against the compose database):

```bash
cd api
npm install
DATABASE_URL="postgresql://flipfeedback:flipfeedback@localhost:5432/flipfeedback?schema=public" npm run seed
```

Then sign in at http://localhost:8080 with the demo account printed by the seed:

```
demo@flipfeedback.com / demo-password-123
```

(The demo password is for the seeded local data only; it is not a real credential.)

## Run locally without Docker (dev mode)

You need a PostgreSQL instance. Point `DATABASE_URL` at it.

```bash
# API
cd api
cp .env.example .env          # then edit DATABASE_URL / JWT_SECRET
npm install
npx prisma generate
npx prisma migrate deploy     # or: npx prisma migrate dev
npm run seed                  # optional demo data
npm run dev                   # http://localhost:4000

# Web (in another terminal)
cd web
npm install
npm run dev                   # http://localhost:5173, proxies /api -> :4000
```

## Configuration (all via environment)

API (`api/.env`, see `api/.env.example`):

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Prisma). |
| `JWT_SECRET` | Secret for signing JWTs. Required in production. |
| `PORT` | API port (default 4000). |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`). |
| `CORS_ORIGINS` | Comma-separated allowed SPA origins. |
| `SEED_DEMO_PASSWORD` | Override the seeded demo password. |

Web:

| Var | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL baked at build (defaults to `/api` via the dev proxy). |
| `API_URL` | In the built container, rewrites the baked placeholder at startup so one image targets any `api.*` host. |

No secret is ever committed; this repo is public.

## The seed entrypoint (integration with flipfeedback-ops)

`api/prisma/seed.ts` is the documented seed entrypoint. It loads a believable, deterministic
demo organization (team, 8 sources across campaign/channel/customer, 6 labels, ~120 feedback
items with varied content and sentiment spread over ~45 days). The richer generator-driven
data ultimately comes from `flipfeedback-ops`; this entrypoint is the contract it targets.

Run it with `npm run seed` or `npx prisma db seed` from `api/`.

## Tests, lint, typecheck

```bash
# API
cd api && npm run lint && npm run typecheck && npm test && npm run build

# Web
cd web && npm run lint && npm run typecheck && npm test && npm run build
```

CI (`ci/github-actions-ci.yml`) runs all of the above and verifies both Docker images build.
It is staged under `ci/` rather than `.github/workflows/`; a maintainer with a workflow-scoped
token (or `flipfeedback-infra`'s deploy automation) copies it into `.github/workflows/` to
activate it.

## API surface (REST)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create org + owner, returns a token. |
| POST | `/auth/login` | Sign in, returns a token. |
| GET | `/auth/me` | Current session. |
| POST | `/auth/password-reset` | Password reset stub. |
| GET/POST | `/feedback` | List (with filters) / create feedback. |
| GET/PATCH | `/feedback/:id` | Read / triage (status, assignment). |
| POST/DELETE | `/feedback/:id/labels[/:labelId]` | Attach / detach a label. |
| GET/POST/PATCH | `/sources` | Connected sources. |
| GET/POST/DELETE | `/labels` | Labels. |
| GET/POST | `/team` | Team members (invite requires owner/admin). |
| GET | `/analytics` | Volume, breakdowns, sentiment, status, trend. |

## Deploy

Images are built here; deployment (EC2 + docker-compose behind nginx) is owned by
`flipfeedback-infra`, which consumes the Dockerfiles and the compose service definitions.
