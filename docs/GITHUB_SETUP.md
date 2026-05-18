# GitHub & staging setup — MyGaragePro

Use this guide after you create your **private GitHub repository**.

## Recommended setup (summary)

| Item | Recommendation |
|------|----------------|
| Repo visibility | **Private** |
| Default branch | `main` |
| Branch protection | Require PR + passing CI before merge to `main` |
| Hosting (staging) | **Railway** (easiest) or **Render** |
| Who gets access | Devs: **Write** · Owner/manager: **Read** or **Triage** (Issues only) |

---

## 1. Create the GitHub repository

1. GitHub → **New repository**
2. Name: `MyGaragePro` (or `mygaragepro`)
3. **Private**
4. Do **not** add README / .gitignore (we already have them)
5. Create repository

## 2. Push this project

From the project folder:

```bash
cd /Users/mujtaba/Documents/Developments/MyGarageProApp

git init
git add .
git commit -m "chore: Phase 0 monorepo scaffold (web shell, api health, CI)"

git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/MyGaragePro.git
git push -u origin main
```

Replace `YOUR_USERNAME/MyGaragePro` with your repo path.

## 3. Team access

**Settings → Collaborators** (or org Teams):

| Person | Role | Why |
|--------|------|-----|
| Developers | Write | Push branches, open PRs |
| Owner / manager | Read | View code optional; test staging only |
| Accountant (optional) | — | No repo access; staging URL only |

For non-dev testers: share the **staging URL** only (see §5), not GitHub.

## 4. Branch workflow

```
main          ← staging auto-deploys here (protected)
  ↑
feature/phase-1-auth   ← PR → CI must pass → merge
```

- **Never** commit secrets (`.env`) — use host secrets / GitHub Actions secrets.
- Small PRs per **gated phase** (see `PROGRESS.md`).

## 5. Deploy staging (Railway — recommended)

### Why Railway

- Connects to GitHub in one click
- Postgres + Redis + two services (web + api) in one project
- Auto-deploy on push to `main`
- Free trial / low cost for early development

### Steps

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo**
2. Select your private repo
3. Create **two services** from the same repo:

**Service A — API**

- Root directory: `apps/api`
- Build: `pnpm install && pnpm build` (or Nixpacks auto-detect)
- Start: `pnpm start:prod`
- Variables:
  - `PORT` = (Railway provides)
  - `NODE_ENV` = `staging`
  - `WEB_ORIGIN` = `https://YOUR-WEB-URL.up.railway.app`
  - `DATABASE_URL` = (from Railway Postgres plugin)

**Service B — Web (Next.js)**

- Root directory: `apps/web`
- Build: `pnpm install && pnpm build`
- Start: `pnpm start`
- Variables:
  - `NEXT_PUBLIC_APP_ENV` = `staging`
  - `API_URL` = `https://YOUR-API-URL.up.railway.app`

4. Add **PostgreSQL** plugin to the project; link `DATABASE_URL` to API.
5. Generate public domains for web + api services.
6. Put the **web URL** in `PROGRESS.md` as **Staging URL**.

### Alternative: Render

Same idea: two services (`apps/web`, `apps/api`) + managed Postgres. See [render.com/docs](https://render.com/docs).

### Alternative: Vercel (web) + Railway (api)

- Vercel: import repo, set root `apps/web`
- Railway: API only
- Set `API_URL` on Vercel to Railway API URL

---

## 6. Optional: protect `main`

**Settings → Branches → Add rule** for `main`:

- Require pull request before merging
- Require status check: **CI / build**
- Do not require admin (small team)

## 7. GitHub Actions (already in repo)

| Workflow | When | What |
|----------|------|------|
| `.github/workflows/ci.yml` | PR + push to main/develop | install, typecheck, build |
| `.github/workflows/deploy-staging.yml` | push to main | build verify (host deploys) |

## 8. Phase 0 staging test URL

After deploy, team tests:

1. `https://your-web-url/...` → login
2. Demo login: `owner@demo.garage` / `demo`
3. Dashboard: sidebar ☰, light/dark, KPI placeholders
4. API: `https://your-api-url/health`

Sign off in `docs/PROGRESS.md` Phase 0 gate when happy.

---

## 9. Production (later)

- Separate Railway project or environment: **production**
- Deploy only from tagged releases or manual promote — not every `main` push.
- Custom domain + SSL when ready for go-live (Phase 15).
