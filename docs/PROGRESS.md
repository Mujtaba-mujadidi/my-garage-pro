# MyGaragePro — Build Progress Tracker

Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md). **Delivery model:** gated phases — build → deploy staging → **you test → sign off** → next module (see PROJECT_PLAN §25).

**Last updated:** 2026-06-02  
**Current phase:** **PCO module UAT** (workflow redesign on feature branch)  
**Current gate:** ⏳ PCO bookings — local UAT on `feat/pco-booking-workflow`  
**UAT note:** Phases 1–3 signed off on **local** (`pnpm dev`); Railway staging deferred.  
**Latest on `main`:** `4cefc29` — PCO module (initial).  
**Active branch:** `feat/pco-booking-workflow` @ `a795f72` (+ uncommitted refinements — reschedule, notes, priority, edit, slot payments).  
**Resume next session:** Read [AGENTS.md](../AGENTS.md), then [PCO_MODULE.md](./PCO_MODULE.md) for full handoff, then **Decision log** and **PCO module** below.

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
| 1 | Auth, settings, Super Admin | `[x]` | `[ ]` | ✅ | 2026-06-04 (local UAT) |
| 2 | Customers | `[x]` | `[ ]` | ✅ | 2026-06-04 (local UAT) |
| 3 | Suppliers | `[x]` | `[ ]` | ✅ | 2026-06-04 (local UAT) |
| 4 | Ledger + banks/cash | `[x]` | `[ ]` | ⏳ | |
| 5 | Invoices + payments | `[x]` | `[ ]` | ⏳ | |
| 6 | Repair jobs + tasks (web) | `[x]` | `[ ]` | ⏳ | |
| 7 | Parts stock | `[x]` | `[ ]` | ⏳ | |
| — | Bodywork (parallel) | `[x]` | `[ ]` | ⏳ | |
| 8 | Tyre stock | `[~]` | `[ ]` | ⏳ | |
| — | **PCO bookings** | `[x]` | `[ ]` | ⏳ | _see [PCO_MODULE.md](./PCO_MODULE.md)_ |
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
- Customers + suppliers API/UI (incl. supplier detail, credit, purchases)
- Shared **Record payment** modal (invoices + customer profile)
- Supplier part-order `supplierId` fix; broader purchase history query
- Tyre add/receive stock purchase UX (cost/VAT/payment)
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
- [x] **You:** Phase 1 UAT (local, 2026-06-04)

**Phase 1+ (included in local UAT)**

- [x] Permissions filtered by garage **enabled modules** (shared + API + role editor)
- [x] Default garage roles: stable slugs; dedupe mechanic/manager duplicates on seed
- [x] Super Admin: PATCH garage details; reset owner password; module save confirm
- [x] Garage edit modal: fixed-height tabs, **sticky footer** Save / Close
- [x] `Select` component; customer/supplier modals use shared patterns
- [ ] Dashboard financial KPI gating (deferred — decide at end of MVP)

**Gate:** ✅ **Signed off:** 2026-06-04 (local UAT — stakeholder Pass)

---

## Phase 2 — Customers

**Build checklist**
- [x] Prisma: `customer`, `customer_vehicle`, `customer_account_terms`
- [x] API: CRUD, search, soft-delete, restore
- [x] Web: list (searchable table), create/edit modal, detail page, archive/restore confirm
- [x] Row actions **⋮** menu (View / Edit / Archive); portal menu (no clip under table)
- [x] RBAC: `customers.read` / `customers.write`
- [x] **You:** UAT (local, 2026-06-04)

**Test script**
1. Add individual customer + vehicle reg.
2. Add business account customer (credit limit, payment terms).
3. Search customer by name and reg.
4. Edit customer; archive and restore (owner).

**Gate:** ✅ **Signed off:** 2026-06-04 (local UAT — stakeholder Pass)

---

## Phase 3 — Suppliers

**Build checklist**
- [x] Prisma migration `20260602101701_suppliers`
- [x] API: CRUD, search, activate/deactivate
- [x] Web: list, create/edit modal, deactivate/activate confirm
- [x] RBAC: `suppliers.read` / `suppliers.write`; nav gated by module + permission
- [x] **Supplier detail** (`/suppliers/[id]`): profile, credit balance + history, job part orders, stock purchases
- [x] API: `GET /suppliers/:id/part-orders`, `GET /suppliers/:id/purchases`
- [x] Part orders save `supplierId`; receive-ordered-part pre-fills supplier
- [x] **You:** UAT (local, 2026-06-04)

**Test script**
1. Add supplier with contact details.
2. Search and edit supplier.
3. Deactivate supplier; activate again.
4. Open supplier detail — credit, part orders, and purchases show linked activity.
5. Order part on repair job with supplier selected; order appears on supplier profile.

**Gate:** ✅ **Signed off:** 2026-06-04 (local UAT — stakeholder Pass) — _detail page + orders: re-test before go-live_

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

**Build checklist (recent)**
- [x] Shared `RecordPaymentModal` — invoices page + **customer profile** (in-page, no redirect)
- [x] Split payment lines + balance hints (remaining / cleared / overpaid)
- [x] Customer **Record payment** button: orange, disabled when no balance due
- [x] Invoices payment modal: customer dropdown **only customers with open balance**
- [x] Modal: fullscreen, fixed height, scrollable payment-received section

**Test script**
1. Create invoice for a customer (lines + VAT toggle).
2. Download PDF.
3. Record £700 payment against 4 invoices (mix of paid + part-paid).
4. Customer balance correct.
5. Undo one allocation (owner) — statuses recompute.
6. From **customer profile**, record payment in modal (split methods if needed).
7. Customer with £0 balance — Record payment disabled on profile.

**Gate:** ⏳ **Signed off:** _

---

## Phase 6 — Repair jobs + tasks (web)

**Build checklist**
- [x] Prisma: `repair_job`, `repair_task`; invoice/ledger link to job
- [x] API: CRUD jobs, tasks, status workflow, assign mechanic, generate invoice + ledger income
- [x] Web: `/repair` list, job detail, tasks, status buttons, invoice from job
- [x] RBAC: `repair.read` / `repair.write`; manager/staff/mechanic defaults
- [x] Seed: 2 demo jobs for ABC Cabs Ltd
- [ ] **You:** UAT (local)

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

## Bodywork jobs (built alongside repair)

**Test script**
1. Open **Bodywork** in sidebar (`/bodywork`).
2. Create job — pick customer, set panel/colour, choose **Insurance** source if applicable.
3. Add tasks (with optional panel per task), approve job, assign staff.
4. Set paint/material and outsourced costs on job; generate invoice — extra lines appear.
5. QC flow: complete tasks → Awaiting QC → sign-off or send back.

**Gate:** ⏳ **Signed off:** _

---

## Phase 8 — Tyre stock

**Build checklist**
- [x] Tyre SKU CRUD, stock movements, receive stock
- [x] Add tyre + receive: buy price ex VAT, Include VAT, payment method / paid from
- [x] Add tyre form order: Stock → Cost → Sell
- [x] Inventory table grouped by size — expand to see brand/supplier lines (separate SKU per supplier)
- [ ] Job tyre picker _(deferred to Phase 9 — not in Phase 8 scope)_
- [ ] **You:** UAT (local)

**Test script**
1. Add tyre SKU (size, brand, qty) with opening stock + purchase payment.
2. Receive stock — same cost/VAT/payment layout as add tyre.
3. Tyre sale or fit on job — stock down, income + COGS in ledger.
4. Fitting charges on invoice.

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
3. Attachment on job, **ledger expense (supplier receipt)**, and invoice.
4. Re-run failed items from earlier gates.

**Gate:** ⏳ **Signed off:** _

---

## Architecture & hosting (planned — not built yet)

Decisions from 2026-06-12 planning (VAT receipts, mobile, go-live). **Use this section to resume work** without relying on chat history. For **PCO bookings**, see [PCO_MODULE.md](./PCO_MODULE.md).

### Production stack (target)

| Layer | Choice | Notes |
|-------|--------|--------|
| Web + API | **Railway** | Current staging/prod path; keep for go-live |
| Database | **Railway Postgres** | Metadata + tenancy (`garageAccountId`); easy to migrate later via `DATABASE_URL` |
| File blobs | **Object storage** (R2 or Supabase Storage) | Receipts/photos; not Postgres BYTEA |
| Queue / workers | **Redis on Railway** | Notifications, PDF jobs (when added) |
| Mobile | **Same API + same DB** | No direct DB access from app; JWT + RBAC |

**Do not** move main app DB to Supabase Postgres for multi-garage — Railway Postgres + Prisma is sufficient.

### VAT receipt / scan upload (backlog)

**Goal:** Attach supplier receipt PDFs to **ledger expenses** (external invoices) for VAT submission.

| Item | Plan |
|------|------|
| v1 scope | Ledger expense entries (+ stock purchases that post ledger) |
| Metadata | `DocumentAttachment` in Postgres (`ledgerEntryId`, `storageKey`, size, `uploadedBy`) |
| Files | Private bucket or Railway Volume for MVP; `StorageService` abstraction to swap R2/Supabase later |
| Web | Upload PDF |
| Mobile / iPad | Camera scan → compress images → merge to small PDF |
| Cost (1 garage, Railway Volume) | ~£0–1/mo for scan storage at current volume |

**Not started** — waiting on hosting confirmation for blob provider.

### Push notifications (backlog)

| Item | Plan |
|------|------|
| In-garage alerts | FCM (iOS/Android) + Web Push (PWA); **not** Supabase Realtime |
| Data | `notifications` + `device_tokens` tables in Postgres |
| Mobile v1 | PWA first; Capacitor/Expo shell if iOS push needs native |

### Tyre inventory UX (design only)

- Separate SKU row per supplier line (same size OK).
- Job picker: `{size} — {brand} · {supplier} · {qty}`; **0 qty disabled**.

---

## Backlog / next build (priority order)

1. **PCO module UAT** — commit uncommitted workflow refinements on `feat/pco-booking-workflow`, test locally, merge to `main`. Handoff: [PCO_MODULE.md](./PCO_MODULE.md).
2. **Phases 4–8 local UAT** sign-off (ledger, invoices, repair, parts, tyres, bodywork).
3. **Tyre job picker** — supplier + stock on repair jobs (Phase 9 with PWA).
4. **Receipt upload Phase 1** — `DocumentAttachment` + API + ledger UI (Phase 14).
5. **Notification tables + Web Push** (pre go-live).
6. **MTD VAT export** incl. receipt links (later).

---

## PCO module — signed-off spec

**Status:** `[x]` Built (initial on `main`) · `[~]` Workflow redesign on `feat/pco-booking-workflow`  
**Gate:** ⏳ UAT  
**Full handoff:** [PCO_MODULE.md](./PCO_MODULE.md) (workflow, API, migrations, UAT script)  
**Shared types:** `packages/shared/src/pco-types.ts`

### Workflow summary

Two-step: **Add request** → **To book** (`PENDING`) → **Add booking details** → **Active** (`ACTIVE`) → **Complete** → **Past**. **Reschedule** on active moves back to To book. Due-to-renew / V5C tabs use a **28-day** window and hide vehicles with open bookings.

### Job types

`Renewal` · `New` · `Admin` · `Logbook expiring` · `Retest` · **`Reschedule`**

### Key fields

**Vehicle:** VRM, keeper, address, contact, first registration, PCO/V5C expiry, optional make/model/colour/fuel/seats, vehicle note.

**Booking:** Job type, priority (High/Medium/Low), charge (default **£140**, no VAT), notes, centre/date/time when scheduled, **slot payment method**, **client informed / confirmed** (Active bookings only, after appointment is booked).

### Tabs (UI)

| Tab | Content |
|-----|---------|
| Active bookings | `ACTIVE` |
| To book | `PENDING` — priority sorted high first |
| Past bookings | `COMPLETED` |
| V5C expiring | Logbook due within 28d |
| Due to renew (28d) | PCO expiry within 28d |
| Centres | Booking centre settings |

### Finance

- No invoice PDF; partial payments on booking → ledger income `source_module = PCO`
- **Customer total due** = service charge (`chargeGross`) + TfL slot expense when **slot paid by Us**; Record payment / balance use this total
- Complete: next PCO expiry = **previous expiry + 1 year**

### Build checklist

- [x] Prisma: `PcoVehicle`, `PcoBooking`, `PcoBookingPayment`; `LedgerSourceModule.PCO`
- [x] API: CRUD, schedule, return-to-book, complete, due lists, VRM lookup, centres
- [x] Web: `/pco` — tabs, two-step flow, ⋮ row actions, edit, notes, slot payment on schedule
- [x] Migrations through `20260617140200_pco_slot_payment_enum` (see PCO_MODULE.md)
- [x] Seed demo centre; `pco.read` / `pco.write` on Manager/Staff
- [ ] Commit latest refinements on feature branch
- [ ] **You:** UAT ([test script in PCO_MODULE.md](./PCO_MODULE.md#uat-test-script))
- [ ] Merge `feat/pco-booking-workflow` → `main`

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
| 2026-06-04 | **Phases 1–3 gate ✅ (local)** | Stakeholder UAT Pass on localhost; Railway deferred | Stakeholder |
| 2026-06-12 | **Record payment on customer page** | Shared modal; no redirect to invoices; split-pay balance hints | Dev |
| 2026-06-12 | **Supplier detail + order linking** | Profile, credit, purchases; `supplierId` on part orders | Dev |
| 2026-06-12 | **Railway for go-live** | API + web + Postgres on Railway; blobs separate | Stakeholder + Dev |
| 2026-06-12 | **Receipt storage** | Postgres metadata + object storage (or Volume MVP); not DB blobs | Dev |
| 2026-06-12 | **Push notifications** | FCM + Web Push + Postgres tables; not Supabase Realtime | Dev |
| 2026-06-12 | **Mobile** | Same NestJS API + JWT; never direct Postgres from app | Dev |
| 2026-06-12 | **Tyre SKUs per supplier line** | Same size allowed; job dropdown shows supplier + qty | Stakeholder |
| 2026-06-13 | **PCO: job types incl. Retest** | Renewal, New, Admin, Logbook expiring, Retest | Stakeholder |
| 2026-06-13 | **PCO expiry roll-forward** | On complete: next expiry = **previous expiry + 1 year**, not completion date | Stakeholder |
| 2026-06-13 | **PCO: no VAT** | PCO charges are VAT-exempt; no invoice PDF | Stakeholder |
| 2026-06-13 | **PCO: new keeper = new record** | Same VRM + new keeper → new vehicle row; archive old | Stakeholder |
| 2026-06-13 | **PCO: ledger only** | Income to ledger `source_module=PCO`; P&L by module in Reports later | Stakeholder |
| 2026-06-13 | **PCO booking datetime** | UK garage local (Europe/London), date + time | Stakeholder |
| 2026-06-02 | **PCO two-step workflow** | Add request → To book → schedule → active; `PENDING` status | Stakeholder |
| 2026-06-02 | **PCO due window 28 days** | Renewals due + V5C expiring tabs | Stakeholder |
| 2026-06-02 | **PCO reschedule** | Active → To book (not inline edit); `RESCHEDULE` job type | Stakeholder |
| 2026-06-02 | **PCO slot charge £140** | Default centre booking fee; editable per booking | Stakeholder |
| 2026-06-02 | **PCO slot paid by** | Add booking details: Us (ledger expense + account), Customer (no expense), N/A (no fee) | Stakeholder |
| 2026-06-02 | **PCO due list exclusion** | Hide from due-to-renew when PENDING/ACTIVE booking exists | Stakeholder |
| 2026-06-02 | **PCO notes + priority** | Notes on bookings; To book sorted by priority | Stakeholder |
| 2026-07-11 | **PCO client informed/confirmed** | Only on **Active** bookings after appointment is booked — not on Add request / To book | Stakeholder |
| 2026-07-13 | **PCO two phone numbers** | `phone` = client contact; `pcoAccountPhone` = number on TfL / PCO centre account | Stakeholder |
| 2026-07-13 | **PCO pass/fail + retest** | Complete → Pass (expiry) or Fail (reason). Failed tab (21d window); Book retest → PENDING RETEST on To book | Stakeholder |
| 2026-07-13 | **PCO expiry optional** | Brand-new vehicles may have no PCO expiry yet; renewals-due skips null | Stakeholder |
| 2026-07-13 | **PCO job types: change of ownership + full test** | Added to job type dropdown | Stakeholder |
| 2026-07-13 | **PCO amend payment** | Correct method/amount after mistakes; reverse prior ledger income + post new | Stakeholder |
| 2026-07-13 | **PCO retest slot expense** | On schedule, retest slot fee defaults to Book-retest TfL charge (or £0 → N/A), not £140 | Stakeholder |
| 2026-07-13 | **PCO customer total = service + slot** | When slot paid by Us, balance/Record payment = service charge (`chargeGross`) + slot expense; Customer/N/A/credit = service only | Stakeholder |
| 2026-07-13 | **PCO amend charges** | View → Charges → amend service charge and (when Us/pending) slot expense; posted slot expense reversed + re-posted | Stakeholder |

---

## Blockers

| Date | Blocker | Phase | Owner | Resolution |
|------|---------|-------|-------|------------|
| 2026-06-04 | Railway web 502 on staging | deploy | Dev | Deferred — develop on local until fixed |

---

## Plan changelog

| Date | Change |
|------|--------|
| 2026-05-08 | Replaced parallel 12-week plan with **15 gated phases** (§25); PROGRESS rewritten with per-phase test scripts |
| 2026-05-19 | Phase 0 signed off; staging URL set; Phase 1 next |
| 2026-06-04 | Phase 2–3 build complete locally; Railway deploy section; Phase 1+ enhancements listed |
| 2026-06-04 | Phases 1–3 signed off (local UAT); Phase 4 next |
| 2026-06-04 | Phase 4 build complete (ledger API + web, migration, seed accounts) |
| 2026-06-05 | Phase 5 build complete (invoices, payments, PDF, allocations, demo ABC invoices) |
| 2026-06-06 | Phase 6 build complete (repair jobs, tasks, invoice from job, ledger REPAIR income) |
| 2026-06-12 | Customer record payment modal; supplier detail/orders; tyre stock purchase UX; payment balance hints (`33d666e`) |
| 2026-06-12 | Architecture notes: Railway go-live, receipt storage, push, mobile API-only |
| 2026-06-13 | PCO module spec signed off; Retest job type; shared `pco-types.ts`; backlog #1 |
| 2026-06-02 | PCO on `main` (`4cefc29`); workflow branch `feat/pco-booking-workflow`; [PCO_MODULE.md](./PCO_MODULE.md) handoff doc |
