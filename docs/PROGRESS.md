# MyGaragePro — Build Progress Tracker

Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md). **Delivery model:** gated phases — build → deploy staging → **you test → sign off** → next module (see PROJECT_PLAN §25).

**Last updated:** 2026-05-19
**Current phase:** Phase 2 — Customers (build ready — deploy + UAT)
**Current gate:** ⏳ Phase 2 staging deploy + your UAT
**Staging URL:** https://mygarageweb-production.up.railway.app

---

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- **Gate:** `⏳` awaiting your test · `✅` signed off · `❌` failed (fix & re-test)

---

## How you sign off a gate

1. Open **staging URL** (above) when the phase is marked ready for test.
2. Follow the **Test script** for that phase below.
3. Log bugs in GitHub Issues (tag with phase number, e.g. `phase-6`).
4. Tell the dev: **Pass** (next phase can start) or **Fail** (list blockers).
5. Dev updates **Gate** column below to ✅ only after your Pass.

**Regression (every gate):** Before signing a new gate, spend ~5 min on the **Smoke checklist** at the bottom.

---

## Gate progress overview

| Phase | Module | Build | Deployed | Gate | Signed off |
|-------|--------|-------|----------|------|------------|
| 0 | Staging + UI shell | `[x]` | `[x]` | ✅ | 2026-05-19 |
| 1 | Auth, settings, Super Admin | `[x]` | `[x]` | ✅ | 2026-05-19 |
| 2 | Customers | `[x]` | `[ ]` | ⏳ | |
| 3 | Suppliers | `[ ]` | `[ ]` | ⏳ | |
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

**Test script (you run on staging)**
1. Open staging URL — page loads over HTTPS.
2. Log in as demo owner.
3. See dashboard shell (sidebar, top bar, KPI card placeholders).
4. Click **☰** — sidebar collapses to icons only; expand again.
5. Toggle **light / dark** — all text readable (tables, KPIs, nav).
6. Log out and log back in.

**Gate criteria:** UI matches approved preview (§28); deploy is automatic; no console errors on login.

**Gate:** ✅ **Signed off:** 2026-05-19 (stakeholder UAT — Pass)

---

## Phase 1 — Auth, settings, Super Admin

**Build checklist**
- [x] Tenancy + Postgres schema; users, roles, permissions (app-layer + tenant context)
- [x] Dynamic settings CRUD + seed defaults
- [x] Audit log; soft delete on settings
- [x] Super Admin: create/suspend garage; enable modules (flags only)
- [x] Custom garage roles + permission modal (`/settings/permissions`)
- [x] Team: create, edit (name, email, role, status, password)
- [ ] **You:** Phase 1 UAT below on staging (see `docs/PHASE1_SETUP.md` for deploy)

**Staging URL:** https://mygarageweb-production.up.railway.app

**Demo accounts** (after seed):

| Role | Email | Password |
|------|--------|----------|
| Super Admin | `admin@mygaragepro.app` | `ChangeMeAdmin1!` |
| Owner | `owner@demo.garage` | `demo` |
| Manager | `manager@demo.garage` | `demo` |
| Mechanic | `mechanic@demo.garage` | `demo` |

### Phase 1 UAT — run in order

Tick each when **Pass** or note **Fail** + what you saw.

**A — Deploy & health**

- [ ] **A1** API health: open `https://YOUR-API-DOMAIN/health` → JSON with `"ok": true`
- [ ] **A2** Web login page loads with no console errors (F12)

**B — Super Admin**

- [ ] **B1** Log in as Super Admin → **Super Admin** in nav
- [ ] **B2** Garage list shows Demo Garage (or create a second garage: name + slug)
- [ ] **B3** Toggle module pills on a garage → save → refresh → still correct
- [ ] **B4** Audit log shows recent platform actions

**C — Owner: settings**

- [ ] **C1** Log out → log in as `owner@demo.garage` / `demo`
- [ ] **C2** **Settings** → add an expense category → appears in list
- [ ] **C3** VAT rates list visible (seeded)

**D — Owner: roles & access**

- [ ] **D1** **Settings** → **Manage roles** → see Manager, Mechanic, Staff (defaults)
- [ ] **D2** **Edit access** on Mechanic → enable **Customers → View** only → Save
- [ ] **D3** **Add role** e.g. `Workshop lead` with limited access → appears in list

**E — Owner: team**

- [ ] **E1** **Team** → list shows owner, manager, mechanic
- [ ] **E2** **Add user** (test email) with role **Staff** → user appears
- [ ] **E3** **Edit** mechanic → change display name → Save → list updates
- [ ] **E4** **Edit** mechanic → change **Role** to Manager → Save
- [ ] **E5** Sign out → log in as mechanic → sidebar matches new role (sign out/in after role change)
- [ ] **E6** **Edit** test user → **Disabled** → they cannot log in
- [ ] **E7** **Edit** owner → only name/email/password; cannot disable owner or change “role”

**F — Staff access (permissions)**

- [ ] **F1** Log in as **mechanic** (after D2: customers view only) → **Customers** visible if granted; **Finance** / **Partners** hidden or access denied
- [ ] **F2** Log in as **manager@demo.garage** → broader access per Manager role defaults
- [ ] **F3** Mechanic cannot open **Settings → Manage roles** (owner only)

**G — Sign-off**

- [ ] **G1** Super Admin audit log shows settings / users / role changes
- [ ] **G2** No blocking bugs → Phase 1 gate **Pass**

**Gate:** ⏳ **Signed off:** _date / name_

---

---

## Phase 2 — Customers

**Build checklist**
- [x] Prisma: `customer`, `customer_vehicle`, `customer_account_terms`
- [x] API: CRUD, search by name/reg, soft-delete, restore (owner/manager)
- [x] Web: list, new, detail, vehicles on customer
- [x] RBAC: `customers.read` / `customers.write`; mechanic read-only
- [ ] **You:** Push, migrate on Railway, redeploy api + web

**Test script**
1. Add individual customer + vehicle reg.
2. Add business account customer (credit limit, payment terms).
3. Search customer by name and reg.
4. Edit customer; soft-delete and restore (owner).

**Gate:** ⏳ **Signed off:** _

---

## Phase 3 — Suppliers

**Test script**
1. Add supplier with contact details.
2. Search and edit supplier.
3. Deactivate supplier (not referenced).

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

---

## Blockers

| Date | Blocker | Phase | Owner | Resolution |
|------|---------|-------|-------|------------|
| | | | | |

---

## Plan changelog

| Date | Change |
|------|--------|
| 2026-05-08 | Replaced parallel 12-week plan with **15 gated phases** (§25); PROGRESS rewritten with per-phase test scripts |
| 2026-05-19 | Phase 0 signed off; staging URL set; Phase 1 next |
