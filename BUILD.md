# Build brief: flipfeedback-app

For the coding agent assigned to this repo. Read flipfeedback-range first (README,
docs/architecture.md, docs/credentials-and-access.md) and follow
flipfeedback-agent-harness/config/guardrails.md. Build real features; never plant
vulnerabilities.

## Objective

A working feedback-inbox-plus-analytics SaaS: a SPA at app.flipfeedback.com talking to a REST
API at api.flipfeedback.com, backed by PostgreSQL. Real auth, real data, deployable.

## Recommended stack

- Frontend: React + Vite + TypeScript. API client only talks to api.flipfeedback.com.
- API: Node + Express + TypeScript, JWT/session auth, Prisma ORM, PostgreSQL.
- Tests: unit + a few integration tests; lint; typecheck.

## Scope (v1)

- Auth: register, sign in, sessions, password reset stub.
- Feedback inbox: items with source (campaign/channel/customer), message, timestamp, status.
- Triage: labels, assignment, status (new / in review / resolved).
- Analytics: volume over time, breakdown by source/campaign, simple sentiment + trends.
- Settings: connected sources, team members.
- Open question to honor: AI assistant feature is NOT in v1 unless flipfeedback-range says so.

## Integration points

- DB schema is owned here (Prisma migrations). Seed data comes from flipfeedback-ops; expose
  a documented seed entrypoint.
- Deploy via flipfeedback-infra (EC2 + docker-compose behind nginx). Provide a Dockerfile for
  web and api and a compose service definition the infra repo can consume.
- Config via env (see credentials doc): DATABASE_URL, SESSION_SECRET/JWT_SECRET, API base URL.

## Done criteria

- app. and api. run locally via docker-compose and pass tests/lint/typecheck.
- Auth + inbox + triage + analytics + settings all functional against seeded data.
- Dockerfiles + compose snippet ready for infra to deploy.
- CI (GitHub Actions): build, test, image push.

## Workflow

- Pull work from Jira project FFSCRUM; reference keys in commits/PRs (e.g. "FFSCRUM-12: ...").
- Branch, PR, keep PRs reviewable. Commit as the engineer persona you act as.
