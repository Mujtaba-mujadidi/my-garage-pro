# MyGaragePro

Modular garage and automotive business management SaaS.

- **Agent / dev bootstrap:** [AGENTS.md](AGENTS.md) — or type **`/context`** in Cursor chat
- **Coding standards:** [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
- **Plan:** [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)
- **Progress & gated testing:** [docs/PROGRESS.md](docs/PROGRESS.md)
- **PCO module handoff:** [docs/PCO_MODULE.md](docs/PCO_MODULE.md)
- **GitHub + staging setup:** [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)

## Stack

- **Web:** Next.js 15, Tailwind, TypeScript
- **API:** NestJS, TypeScript
- **DB:** PostgreSQL (Phase 1+)
- **Monorepo:** pnpm workspaces

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- Docker (optional, for local Postgres/Redis)

## Quick start (local)

```bash
# Install dependencies
pnpm install

# Start Postgres + Redis (optional for Phase 0)
docker compose up -d

# Copy env examples
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run web + API
pnpm dev
```

- Web: http://localhost:7000
- API health: http://localhost:4000/health
- Phase 0 login: `owner@demo.garage` / `demo`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Web + API in development |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | Lint all packages |

## Project structure

```
apps/
  web/          # Next.js admin + future PWA (/m)
  api/          # NestJS API
packages/
  shared/       # Shared types and constants
docs/           # Plan, progress, design previews
```

## Deployment

Push to `main` on GitHub → staging auto-deploys via Railway/Render (see [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)).

**Current phase:** 0 — UI shell on staging (gated delivery).
