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

## Troubleshooting: repo not listed on Railway

Your repo must exist on GitHub **and** the **Railway GitHub App** must be allowed to see it (especially for **private** repos).

**This project’s repo:** `Mujtaba-mujadidi/my-garage-pro` (private)

### Fix (do in order)

1. **Confirm the repo on GitHub**  
   Open: https://github.com/Mujtaba-mujadidi/my-garage-pro  
   You should see the code (not 404).

2. **Grant Railway access to the repo**
   - GitHub → click your **profile photo** → **Settings**
   - Left sidebar: **Applications** → **Installed GitHub Apps**
   - Click **Railway** (or **Configure** next to it)
   - Under **Repository access**, choose either:
     - **All repositories** (easiest), or
     - **Only select repositories** → add **`my-garage-pro`**
   - Save

   **If Railway is not in the list:** install it from Railway first:
   - Railway → New Project → GitHub Repositories → **Configure GitHub App** / **Authorize**
   - Complete GitHub login and approve access

3. **Same GitHub account everywhere**  
   Railway must be logged into the same GitHub user that owns `Mujtaba-mujadidi/my-garage-pro`.  
   Railway → Account Settings → disconnect/reconnect GitHub if you use multiple accounts.

4. **Refresh Railway**
   - Back to Railway → New Project → GitHub Repositories
   - Search: `my-garage-pro` or `garage`
   - If still missing: log out of Railway, log in again, retry

5. **Organization repo?**  
   If the repo were under a **GitHub Organization**, an org owner must approve Railway for that org. Your repo is under your **personal account**, so step 2 is enough.

### Still not listed?

Use **Empty Project** → **+ New** → **GitHub Repo** → **Configure GitHub App** again, or deploy once via CLI:

```bash
npm i -g @railway/cli
railway login
cd apps/web
railway init
railway up
```

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
git remote add origin https://github.com/Mujtaba-mujadidi/my-garage-pro.git
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

### You connected the repo — deploy next (step by step)

Railway created **one service** from your repo. This project is a **pnpm monorepo**, so both services must build from the **repository root** (`/`), not from `apps/web` alone.

Repo: `Mujtaba-mujadidi/my-garage-pro` · branch: `main`

---

#### Railway UI map (2025 — no “Source” tab)

1. Open your **project** (canvas with boxes).
2. **Click the service box** (e.g. `my-garage-pro`) — not the project name at the top.
3. Use the tabs at the top of that panel: **Deployments · Variables · Metrics · Settings**.
4. Everything is under **Settings** — scroll down. Look for these **sections** (names may vary slightly):
   - **Service Source** — Connect Repo / branch (only if the service is empty)
   - **Root Directory**
   - **Build** — custom build command
   - **Deploy** — custom start command
   - **Networking** — public domain (sometimes also a **Networking** tab)
5. After changing settings, Railway may show **Staged changes** on the canvas → click **Deploy** / **Apply** on that banner.

When you add a 2nd service via **+ New → GitHub Repo**, the repo is linked **at creation** — you will **not** see a separate Source step; go straight to **Settings** → Build / Deploy.

---

#### Step 1 — Configure the **Web** service (use your existing service)

1. Click the **first service** on the canvas (rename to **web** via right‑click → Update Info, optional).
2. Open **Settings** → scroll to **Service Source** (optional check): repo `my-garage-pro`, branch **`main`**.  
   If you already deployed from GitHub, this is already set — skip if you don’t see it.
3. In **Settings**, find **Build** and **Deploy** (or **Custom Build Command** / **Start Command**):
   - **Root Directory:** leave **empty** or `/` (repo root — **not** `apps/web`)
   - **Custom Build Command:**
     ```bash
     pnpm install && pnpm --filter @mygaragepro/web build
     ```
   - **Custom Start Command:**
     ```bash
     pnpm --filter @mygaragepro/web start
     ```
4. **Variables** tab → add:
   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_APP_ENV` | `staging` |
   | `NODE_ENV` | `production` |
   | `API_URL` | _(add after Step 3 — API public URL)_ |
5. **Settings** → **Networking** (or **Networking** tab) → enable **Public Networking** → **Generate Domain** → copy the URL.
6. If a **Staged changes** banner appeared on the canvas → click **Deploy** / **Apply**.
7. **Deployments** tab → wait for **Success**; if failed, open logs and **Redeploy**.

**Test:** open the web domain → you should see the **login** page.

---

#### Step 2 — Add the **API** service (second service, same repo)

1. On the **project canvas** (not inside a service): click **+ New** (top right) or press `Cmd+K` / `Ctrl+K` → choose **GitHub Repo**.
2. Select **`my-garage-pro`** → Railway creates a **second** service (repo is connected automatically — no Source menu).
3. Click the **new service** box → rename to **api** (right‑click → Update Info).
4. **Settings** → scroll to **Build** / **Deploy** (same as web — repo root):
   - **Root Directory:** empty / `/`
   - **Build Command:**
     ```bash
     pnpm install && pnpm --filter @mygaragepro/api build
     ```
   - **Start Command:**
     ```bash
     pnpm --filter @mygaragepro/api start:prod
     ```
5. **Variables:**
   | Name | Value |
   |------|--------|
   | `NODE_ENV` | `staging` |
   | `WEB_ORIGIN` | your **web** domain from Step 1 |
6. **Networking** → **Generate Domain**.
7. **Test:** open `https://YOUR-API-DOMAIN/health` → JSON `{ "ok": true, ... }`.

---

#### Step 3 — Link web → API

1. On the **web** service → **Variables** → set:
   - `API_URL` = `https://YOUR-API-DOMAIN` (no trailing slash)
2. **Redeploy** the web service (Deployments → Redeploy).

On the live site, dashboard footer link `/api/backend/health` should proxy to the API.

---

#### Step 4 — Postgres (required for Phase 1)

- **+ New** → **Database** → **PostgreSQL**
- On **api** service → **Variables** → add `DATABASE_URL`, `JWT_SECRET`, etc.

**Full Phase 1 checklist:** see **[docs/PHASE1_SETUP.md](PHASE1_SETUP.md)** (migrate, seed, test accounts).

---

#### Step 5 — Team testing

1. Put the **web domain** in [PROGRESS.md](PROGRESS.md) → **Staging URL**.
2. Share that URL with your team (no GitHub access needed).
3. Login: `owner@demo.garage` / `demo`
4. Run the Phase 0 test script in PROGRESS.md → sign off the gate.

---

#### Auto-deploy

Every **push to `main`** on GitHub redeploys staging (if Settings → Source → **Wait for CI** is off, deploy starts immediately).

### Quick reference (both services)

| Service | Root dir | Build | Start |
|---------|----------|-------|-------|
| **web** | `/` (repo root) | `pnpm install && pnpm --filter @mygaragepro/web build` | `pnpm --filter @mygaragepro/web start` |
| **api** | `/` (repo root) | `pnpm install && pnpm --filter @mygaragepro/api build` | `pnpm --filter @mygaragepro/api start:prod` |

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
