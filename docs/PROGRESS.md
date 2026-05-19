# MyGaragePro — Build Progress Tracker

Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md). **Delivery model:** gated phases — build → deploy staging → **you test → sign off** → next module (see PROJECT_PLAN §25).

**Last updated:** 2026-05-19
**Current phase:** Phase 1 — Auth, settings, Super Admin (code ready — configure Railway Postgres)
**Current gate:** ⏳ Phase 1 staging deploy + your UAT
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
| 1 | Auth, settings, Super Admin | `[x]` | `[ ]` | ⏳ | |
| 2 | Customers | `[ ]` | `[ ]` | ⏳ | |
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
- [ ] **You:** Railway Postgres + env vars + migrate/seed (see `docs/PHASE1_SETUP.md`)

**Test script**
1. Super Admin creates a second test garage (or uses demo).
2. Owner edits settings (e.g. add expense category, VAT rate).
3. Create manager + mechanic users; log in as each.
4. Mechanic cannot open ledger or partner screens.
5. Super Admin audit log shows settings change.

**Gate:** ⏳ **Signed off:** _

---

## Phase 2 — Customers

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
