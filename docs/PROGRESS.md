# MyGaragePro — Build Progress Tracker

Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md). **Delivery model:** gated phases — build → deploy staging → **you test → sign off** → next module (see PROJECT_PLAN §25).

**Last updated:** 2026-06-04  
**Current phase:** Phase 2–3 — Customers + Suppliers (built locally; **staging deploy pending**)  
**Current gate:** ⏳ Push to `main` → Railway redeploy → team UAT on staging  
**Staging URL:** _Railway → **web** service → Settings → Networking → **Public domain**_ (verify in dashboard; stale docs URLs cause 404)

**Local dev:** [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) · **Railway deploy:** [RAILWAY_AUTODEPLOY.md](./RAILWAY_AUTODEPLOY.md)

---

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- **Gate:** `⏳` awaiting your test · `✅` signed off · `❌` failed (fix & re-test)

---

## How you sign off a gate

1. Open **staging URL** when the phase is marked ready for test.
2. Follow the **Test script** for that phase below (or `docs/UAT_TEST_CASES.csv`).
3. Log bugs in GitHub Issues (tag with phase number, e.g. `phase-3`).
4. Tell the dev: **Pass** (next phase can start) or **Fail** (list blockers).
5. Dev updates **Gate** column below to ✅ only after your Pass.

**Regression (every gate):** Before signing a new gate, spend ~5 min on the **Smoke checklist** at the bottom.

---

## Gate progress overview

| Phase | Module | Build | Deployed | Gate | Signed off |
|-------|--------|-------|----------|------|------------|
| 0 | Staging + UI shell | `[x]` | `[x]` | ✅ | 2026-05-19 |
| 1 | Auth, settings, Super Admin | `[x]` | `[~]` | ⏳ | 2026-05-19 (partial — see Phase 1+) |
| 2 | Customers | `[x]` | `[ ]` | ⏳ | |
| 3 | Suppliers | `[x]` | `[ ]` | ⏳ | |
| 4 | Ledger + banks/cash | `[ ]` | `[ ]` | ⏳ | |
| 5 | Invoices + payments | `[ ]` | `[ ]` | ⏳ | |
| 6 | Repair jobs + tasks (web) | `[ ]` | `[ ]` | ⏳ | |
| 7 | Parts stock | `[ ]` | `[ ]` | ⏳ | |
| 8 | Tyre stock | `[ ]` | `[ ]` | ⏳ | |
| 9 | Mechanic PWA | `[ ]` | `[ ]` | ⏳ | |
| 10 | Used cars | `[ ]` | `[ ]` | ⏳ | |
| 11 | Partners | `[ ]` | `[ ]` | ⏳ | |
| 12 | Rental (basic) | `[ ]` | `[ ]` | ⏳ | |
| 13 | Reports + dashboard | `[ ]` | `[ ]` | ⏳ | |
| 14 | Polish (cash, adjust, bugs) | `[ ]` | `[ ]` | ⏳ | |
| 15 | Go-live | `[ ]` | `[ ]` | ⏳ | |

---

## Railway: does `git push main` apply everything?

**Short answer:** Yes, **if** each Railway service is connected to GitHub `main` with **auto deploy** on — but only for services whose **watch paths** include the files you changed. This repo uses `apps/api/railway.toml` and `apps/web/railway.toml` for that.

| What | Automatic on push to `main`? | Notes |
|------|------------------------------|--------|
| **Web build & deploy** | Yes (web service) | Rebuilds when `apps/web/**`, `packages/shared/**`, or lockfile changes |
| **API build & deploy** | Yes (api service) | Rebuilds when `apps/api/**`, `packages/shared/**`, or lockfile changes |
| **DB migrations** | Yes (API **start** command) | `prisma migrate deploy` runs on every API container start — see `apps/api/railway.toml` |
| **Seed data** | **No** | `prisma db seed` is **not** run on Railway; run manually if needed |
| **Docs-only push** | **Skipped** | Watch paths exclude `docs/**` — use **Deployments → Deploy** to force |

**After this push, staging should pick up:**

- Migration `20260602101701_suppliers` (and any earlier not yet applied)
- Customers + suppliers API/UI
- Super Admin garage edit (tabs, sticky save bar)
- Settings tabs (General + Roles & access)
- Team delete, disable/enable confirmations
- Dynamic permissions per enabled module

**Verify after deploy:** API logs show `migrate deploy` success; web build SHA on staging matches latest commit.

---

## Pre-build checklist (before Phase 0)

- [ ] Stakeholder sign-off on `PROJECT_PLAN.md` v1.0 + gated delivery (§25)
- [ ] Answer §27 open questions (currency, VAT, labour rates, staging host, etc.)
- [ ] Confirm tech stack (NestJS + Postgres + Next.js + Redis + S3/R2)
- [x] **Staging host** chosen (Railway)
- [x] **GitHub** private repo + push (`my-garage-pro`)
- [x] Staging domain / URL agreed
- [x] UI design direction + collapsible sidebar + dark mode spec
- [ ] Copy `rms designs.pdf` → `docs/design/refs/` (optional)
- [ ] Founding-garage data export for Phase 15 import

---

## Phase 0 — Staging + UI shell

**Build checklist**
- [x] Monorepo: `apps/api/`, `apps/web/`, `packages/shared/`, `docker-compose.yml`
- [x] GitHub Actions CI (`.github/workflows/ci.yml`)
- [x] **You:** Create private GitHub repo + push (see `docs/GITHUB_SETUP.md`)
- [x] **You:** Connect Railway → staging URL
- [ ] Staging Postgres (Phase 1 — required for auth/tenancy)
- [x] Login page (demo: `owner@demo.garage` / `demo`)
- [x] AppShell (navy rail, orange pill, collapse, light/dark, mobile drawer)
- [x] Dashboard layout (KPI placeholders + demo table/chart)
- [x] Mobile scroll, responsive top bar, Phase 0 sign out

**Gate:** ✅ **Signed off:** 2026-05-19

---

## Phase 1 — Auth, settings, Super Admin

**Build checklist**
- [x] Tenancy + Postgres schema; users, roles, permissions (app-layer + tenant context)
- [x] Dynamic settings CRUD + seed defaults (VAT + expense categories on garage create / first load)
- [x] Audit log; soft delete on settings
- [x] Super Admin: create/suspend garage; enable modules; **edit garage** (details, modules, security tabs)
- [x] Custom garage roles + permission editor (per-module read/write; table UI)
- [x] Settings page: **General** + **Roles & access** tabs (`/settings/permissions` redirects)
- [x] Team: create, edit, disable/enable (confirm), **delete** (soft-delete + confirm)
- [ ] **You:** Full Phase 1 UAT on **updated** staging after Railway deploy

**Phase 1+ (since last staging deploy — local only until push)**

- [x] Permissions filtered by garage **enabled modules** (shared + API + role editor)
- [x] Default garage roles: stable slugs; dedupe mechanic/manager duplicates on seed
- [x] Super Admin: PATCH garage details; reset owner password; module save confirm
- [x] Garage edit modal: fixed-height tabs, **sticky footer** Save / Close
- [x] `Select` component; customer/supplier modals use shared patterns
- [ ] Dashboard financial KPI gating (deferred — decide at end of MVP)

**Gate:** ⏳ Re-test on staging after deploy

---

## Phase 2 — Customers

**Build checklist**
- [x] Prisma: `customer`, `customer_vehicle`, `customer_account_terms`
- [x] API: CRUD, search, soft-delete, restore
- [x] Web: list (searchable table), create/edit modal, detail page, archive/restore confirm
- [x] Row actions **⋮** menu (View / Edit / Archive); portal menu (no clip under table)
- [x] RBAC: `customers.read` / `customers.write`
- [ ] **You:** UAT on staging after deploy

**Test script**
1. Add individual customer + vehicle reg.
2. Add business account customer (credit limit, payment terms).
3. Search customer by name and reg.
4. Edit customer; archive and restore (owner).

**Gate:** ⏳ **Signed off:** _

---

## Phase 3 — Suppliers

**Build checklist**
- [x] Prisma migration `20260602101701_suppliers`
- [x] API: CRUD, search, activate/deactivate
- [x] Web: list, create/edit modal, deactivate/activate confirm
- [x] RBAC: `suppliers.read` / `suppliers.write`; nav gated by module + permission
- [ ] **You:** UAT on staging after deploy

**Test script**
1. Add supplier with contact details.
2. Search and edit supplier.
3. Deactivate supplier; activate again.

**Gate:** ⏳ **Signed off:** _

---

## Phase 4 — Ledger + banks/cash

**Test script**
1. Add bank account and cash account.
2. Post expense (pending) → manager check → owner approve → posted.
3. Post income to bank; balance updates.
4. Attempt edit on posted entry — must fail; use reversal instead.
5. View audit trail on finance actions.

**Gate:** ⏳ **Signed off:** _

---

## Phase 5 — Invoices + payments

**Test script**
1. Create invoice for a customer (lines + VAT toggle).
2. Download PDF.
3. Record £700 payment against 4 invoices (mix of paid + part-paid).
4. Customer balance correct.
5. Undo one allocation (owner) — statuses recompute.

**Gate:** ⏳ **Signed off:** _

---

## Phase 6 — Repair jobs + tasks (web)

**Test script**
1. Create repair job (customer, vehicle, status flow).
2. Add tasks; assign mechanic.
3. Move job through: quote → approved → in progress → ready.
4. Generate invoice from job; record payment (Phase 5).
5. Ledger entries exist for job.

**Gate:** ⏳ **Signed off:** _

---

## Phase 7 — Parts stock

**Test script**
1. Add part with qty and min level.
2. On open job, consume part — stock decrements, line on invoice.
3. Return unused part to stock.
4. Low-stock shows on dashboard (if Phase 13 not done, on parts screen).

**Gate:** ⏳ **Signed off:** _

---

## Phase 8 — Tyre stock

**Test script**
1. Add tyre SKU (size, brand, qty).
2. Tyre sale or fit on job — stock down, income + COGS in ledger.
3. Fitting charges on invoice.

**Gate:** ⏳ **Signed off:** _

---

## Phase 9 — Mechanic PWA

**Test script**
1. On phone, open staging `/m`, install PWA.
2. Login as mechanic; see assigned tasks.
3. Accept → start → pause → complete; upload photo.
4. Select part from stock (Phase 7) on task.
5. Manager sees job update on web.

**Gate:** ⏳ **Signed off:** _

---

## Phase 10 — Used cars

**Test script**
1. Add stock vehicle with purchase price.
2. Add prep costs (repair/internal).
3. Record sale (deposit + balance); per-vehicle P/L view.
4. P/L matches ledger filter by vehicle.

**Gate:** ⏳ **Signed off:** _

---

## Phase 11 — Partners

**Test script**
1. Enable partners; add your partners + split rule (e.g. equal).
2. Record capital contribution.
3. Run profit distribution for a period; approve.
4. Record drawing; capital unchanged, profit entitlement reduced.

**Gate:** ⏳ **Signed off:** _

---

## Phase 12 — Rental (basic)

**Test script**
1. Create rental agreement (weekly rent, due day).
2. Record rent payment; arrears if late.
3. Add rental expense (e.g. repair); shows on rental P/L.

**Gate:** ⏳ **Signed off:** _

---

## Phase 13 — Reports + dashboard

**Test script**
1. Dashboard KPIs match ledger (today profit, open jobs, unpaid).
2. Weekly P/L report; filter by date and legal company.
3. Export CSV; customer balance / invoice ageing.

**Gate:** ⏳ **Signed off:** _

**Deferred:** Role-based hiding of financial dashboard widgets (see Phase 1+).

---

## Phase 14 — Polish

**Test script**
1. Daily cash close with variance.
2. Stock adjustment (parts/tyres) with approval.
3. Attachment on job and invoice.
4. Re-run failed items from earlier gates.

**Gate:** ⏳ **Signed off:** _

---

## Phase 15 — Go-live

**Test script**
1. Import founding-garage data (or agreed subset).
2. Production deploy; smoke test with owner.
3. Real users trained; support process agreed.

**Gate:** ⏳ **Signed off:** _

---

## Regression smoke (run before every new gate sign-off)

- [ ] Login / logout works
- [ ] Sidebar + dark mode OK
- [ ] Previous module’s core flow still works (see last signed-off phase)
- [ ] No cross-tenant data leak (if multi-garage on staging)

---

## Decision log

| Date | Decision | Rationale | Author |
|------|----------|-----------|--------|
| 2026-05-05 | Tenant = Garage Account | See PROJECT_PLAN | Plan v1.0 |
| 2026-05-08 | Partner module configurable | SaaS resale | Stakeholder |
| 2026-05-08 | GitHub + staging from Phase 0 | Team browser testing | Stakeholder |
| 2026-05-08 | UI: Option 8 pattern, MyGaragePro content | RMS reference | Stakeholder |
| 2026-05-08 | Collapsible sidebar + dark mode WCAG | Preview feedback | Stakeholder |
| 2026-05-08 | **Gated delivery: test & sign off each module before next** | Owner wants phase-by-phase UAT | Stakeholder |
| 2026-05-19 | **Phase 0 gate ✅** | Staging UAT Pass — UI shell, mobile, sign out | Stakeholder |
| 2026-06-04 | **Dashboard RBAC deferred** | Focus core modules; gate financial KPIs at end | Stakeholder |
| 2026-06-04 | **Disable ≠ delete** for team | Disable = reversible; delete = soft-remove from list | Dev |

---

## Blockers

| Date | Blocker | Phase | Owner | Resolution |
|------|---------|-------|-------|------------|
| 2026-06-04 | Railway staging behind `main` | 2–3 | Dev | Push + verify auto-deploy & migrations |

---

## Plan changelog

| Date | Change |
|------|--------|
| 2026-05-08 | Replaced parallel 12-week plan with **15 gated phases** (§25); PROGRESS rewritten with per-phase test scripts |
| 2026-05-19 | Phase 0 signed off; staging URL set; Phase 1 next |
| 2026-06-04 | Phase 2–3 build complete locally; Railway deploy section; Phase 1+ enhancements listed |
