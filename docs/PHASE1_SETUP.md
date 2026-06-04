# Phase 1 — Setup guide (you + Railway)

Phase 1 adds **real auth**, **Postgres**, **roles**, **settings**, and **Super Admin**. Follow these steps on Railway and locally.

---

## 1. Railway: add PostgreSQL

1. Open your **MyGaragePro** project on [Railway](https://railway.app).
2. Click **+ New** → **Database** → **PostgreSQL**.
3. Wait until the database is **Online**.

---

## 2. Railway: configure the **API** service

Click the **api** service → **Variables**. Add or reference:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Reference from Postgres service (`${{Postgres.DATABASE_URL}}` or copy from Postgres → Connect) |
| `JWT_SECRET` | Long random string (e.g. generate with `openssl rand -base64 32`) |
| `JWT_EXPIRES_IN` | `12h` |
| `NODE_ENV` | `staging` |
| `WEB_ORIGIN` | Your **web** public URL (no trailing slash), e.g. `https://mygarageproweb-production.up.railway.app` |
| `PORT` | Railway sets this automatically — leave as-is if present |

**Build command** (Settings → Build):

```bash
pnpm install && pnpm --filter @mygaragepro/shared build && pnpm --filter @mygaragepro/api exec prisma generate && pnpm --filter @mygaragepro/api build
```

**Start command** (Settings → Deploy) — run migrations then start:

```bash
pnpm --filter @mygaragepro/api exec prisma migrate deploy && pnpm --filter @mygaragepro/api start:prod
```

(Build outputs to `dist/apps/api/src/main.js` in the monorepo; `start:prod` points at that path.)

Optional one-time seed (Railway → api → **Deploy** → run as custom command or locally against staging DB):

```bash
pnpm --filter @mygaragepro/api db:seed
```

**Networking:** ensure the API has a **public domain** (Generate Domain).

**Test:** open `https://YOUR-API-DOMAIN/health` → `"phase": "1"`.

---

## 3. Railway: configure the **web** service

**Root Directory:** leave **empty** (repository root). Do **not** set `apps/web`.

**Settings → Config file:** `/apps/web/railway.toml` (recommended).

**Settings → Build** (repo root, not `apps/web`):

```bash
pnpm install && pnpm --filter @mygaragepro/shared build && NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA pnpm --filter @mygaragepro/web build
```

**Settings → Deploy → Start command** (or use `railway.toml`):

```bash
sh apps/web/scripts/railway-start.sh
```

| Variable | Value |
|----------|--------|
| `API_URL` | `https://YOUR-API-DOMAIN` (no trailing slash) |
| `NEXT_PUBLIC_APP_ENV` | `staging` |

After deploy, the amber **STAGING** bar should show `build abc1234` (git short SHA). If it does not, the web service is still on an old deployment — open **Deployments** → **Redeploy** on the latest **Success**, or fix a failed build in the logs.

**Pushed to GitHub but Railway did not build?** See [RAILWAY_AUTODEPLOY.md](./RAILWAY_AUTODEPLOY.md). If the log says **“No changes to watched files”**, set config files `/apps/web/railway.toml` and `/apps/api/railway.toml` or clear watch paths, then **Deploy** manually.

Redeploy **web** after saving variables.

---

## 4. Local development

**Full guide (daily workflow, git, migrations):** [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)

Quick start:

```bash
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3011  
- API: http://localhost:4000/health  

If you already have `apps/api/.env` with `WEB_ORIGIN=http://localhost:3000`, update it to `http://localhost:3011` (see `docs/LOCAL_DEVELOPMENT.md` for ports).

Use this while Railway deploys are paused; push to `main` when ready for the team to test on staging.

---

## 5. Default accounts (after seed)

| Role | Email | Password |
|------|--------|----------|
| Super Admin | `admin@demo.garage` | `demo` (or `SEED_SUPER_ADMIN_*` in `apps/api/.env`) |
| Owner (demo garage) | `owner@demo.garage` | `demo` |
| Manager | `manager@demo.garage` | `demo` |
| Mechanic | `mechanic@demo.garage` | `demo` |

**Change Super Admin password** on staging via Railway variables before go-live:

```
SEED_SUPER_ADMIN_EMAIL=admin@mygaragepro.app
SEED_SUPER_ADMIN_PASSWORD=<your-strong-password>
```

Then re-run seed (or update password in DB).

---

## 6. Phase 1 test script (staging)

1. Log in as **Super Admin** → **Super Admin** → create a second garage (name + slug).
2. Toggle modules on that garage (pills).
3. Log in as **owner@demo.garage** → **Settings** → add an expense category.
4. **Team** → create a mechanic user (or use `mechanic@demo.garage`).
5. Log in as **mechanic** → **Ledger** and **Partners** should show **Access denied** (or nav hidden).
6. Super Admin → audit log shows settings change.

---

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| API **Crashed** on Railway | Check deploy logs; usually missing `DATABASE_URL` or failed migration |
| Login: “Could not sign in” | API down or `API_URL` wrong on web service |
| 401 on all routes | `JWT_SECRET` changed after tokens issued — log in again |
| Empty settings | Run `pnpm db:seed` against the same database as API |

---

## 8. What you do **not** need to configure

- GitHub (already connected)
- Custom domain (optional)
- Redis (Phase 1 does not use it yet)
- Separate Vercel (web is on Railway)

When Phase 1 passes UAT, sign off in `docs/PROGRESS.md` (Phase 1 gate).
