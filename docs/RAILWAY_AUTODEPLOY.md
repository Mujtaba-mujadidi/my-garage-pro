# Railway not deploying after `git push`

Git is updated on GitHub (`main`), but Railway shows **no new deployment**. Use this checklist.

Repo: **`Mujtaba-mujadidi/my-garage-pro`** · branch: **`main`**

---

## 0. “No changes to watched files” (skipped deploy)

Railway **skipped** the build because **watch paths** did not include the files in your commit.

Example: a push that only changes `docs/**` will correctly **not** rebuild **web** or **api** if watch paths are `apps/web/**` only.

### Fix (choose one)

**Option A — Recommended: use repo config (in this project)**

1. **Web** service → **Settings** → **Config file** → `/apps/web/railway.toml`
2. **API** service → **Settings** → **Config file** → `/apps/api/railway.toml`
3. Redeploy both services once (Deployments → **Deploy**)

Those files set watch paths to include **shared** + lockfile + the app folder.

**Option B — Clear watch paths in the UI**

1. Service → **Settings** → **Watch paths** (or **Build** → watch patterns)
2. **Delete all lines** (leave empty) → deploy on **every** push to `main`
3. **Apply** staged changes on the project canvas

**Option C — Manual patterns in the UI (per service)**

**Web** — one pattern per line:

```
apps/web/**
packages/shared/**
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

**API**:

```
apps/api/**
packages/shared/**
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

After fixing watch paths, run **Deployments → Deploy** (manual) so the latest `main` (e.g. `9f62411`) actually builds — a docs-only push will still skip, and that is expected.

---

## 1. Confirm GitHub has the commit

```bash
git log -1 --oneline
git push origin main
```

Open: https://github.com/Mujtaba-mujadidi/my-garage-pro/commits/main  
The latest commit (e.g. `9f62411`) must appear there.

---

## 2. Fix GitHub → Railway link (most common)

### A. Railway GitHub App can see the repo

1. GitHub → **Settings** → **Applications** → **Installed GitHub Apps** → **Railway**
2. **Repository access** → include **`my-garage-pro`** (or “All repositories”)
3. Save

### B. Each service is connected to the repo

Do this for **both** **web** and **api** services:

1. Railway → your project → click the **service** box
2. **Settings** → **Source** / **Service Source**
3. Must show:
   - **Connected repo:** `Mujtaba-mujadidi/my-garage-pro`
   - **Branch:** `main`
   - **Auto deploy:** ON (or “Deploy on push” enabled)

If it says **“No source”** or only **CLI** / empty:

- **Connect Repo** → select `my-garage-pro` → branch `main` → save  
- Or: **+ New** → **GitHub Repo** → same repo (creates a new service; delete the old disconnected one if duplicate)

### C. Turn off “Wait for CI” (very common blocker)

If **Wait for CI** is enabled but this repo has **no** GitHub Actions workflow, Railway **never** deploys.

1. Service → **Settings** → **Source**
2. Disable **Wait for CI** / **Wait for GitHub checks**
3. **Apply** / **Deploy** on the project canvas if you see **Staged changes**

---

## 3. Apply staged settings (easy to miss)

After changing build commands or source:

1. Go back to the **project canvas** (grid of service boxes)
2. If you see **“Staged changes”** or **“Apply”** → click it
3. Then check **Deployments** for a new build

---

## 4. Manual deploy (works even when auto-deploy is broken)

### Option A — Railway dashboard

For **web** and **api** separately:

1. Open the service → **Deployments**
2. **Deploy** (top right) or **⋯** → **Redeploy** on the latest deployment
3. Wait for **Success** (fix logs if **Failed**)

### Option B — Railway CLI

```bash
npm i -g @railway/cli
railway login
cd /path/to/MyGarageProApp
railway link          # pick your project
railway service       # select web → deploy
railway up --detach

railway service       # select api → deploy
railway up --detach
```

---

## 5. Correct build commands (repo root)

### Web service

**Build:**

```bash
pnpm install && pnpm --filter @mygaragepro/shared build && NEXT_PUBLIC_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA pnpm --filter @mygaragepro/web build
```

**Start:**

```bash
pnpm --filter @mygaragepro/web start
```

**Root directory:** empty (not `apps/web`)

### API service

**Build:**

```bash
pnpm install && pnpm --filter @mygaragepro/shared build && pnpm --filter @mygaragepro/api build
```

**Start** (must run migrations):

```bash
cd apps/api && pnpm exec prisma migrate deploy && pnpm run start:prod
```

Or whatever you already use if `start:prod` includes migrate — check `apps/api/package.json`.

**Root directory:** empty (not `apps/api`)

---

## 6. Verify the new build is live

**Web:** amber bar shows `build <short-sha>` (e.g. `build 9f62411`)  
**Admin:** “Register garage” modal with full form; edit garage has **Save** / **Cancel**, not **Done**

**API:** new migration `20260520120000_garage_registration_fields` applied (check deploy logs for `migrate deploy`)

---

## 7. Still stuck?

1. Railway → **Project Settings** → confirm the project is not **paused** / out of credits  
2. Disconnect and reconnect GitHub in Railway **Account Settings**  
3. Create a **new** service from **GitHub Repo** → `my-garage-pro` → `main`, copy env vars from the old service, delete the old service  
4. Push an empty commit to test the webhook:

```bash
git commit --allow-empty -m "chore: trigger Railway deploy"
git push origin main
```

If still no deployment appears within 1–2 minutes, the webhook is not connected — use **Manual deploy** (section 4) until source is fixed.
