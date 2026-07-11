# MyGaragePro — Agent bootstrap

Read this file **before writing code**. It routes you to the agreed requirements, current work, and non-negotiable rules.

---

## What this project is

**MyGaragePro** is a modular, multi-tenant SaaS for UK garages. One **Garage Account** is the tenant (not legal company). Modules (customers, repair, ledger, PCO, etc.) are feature flags per garage. Every money event must hit the central ledger. Delivery is **gated**: build one module → UAT → sign off → next phase.

**Stack:** pnpm monorepo — `packages/shared` → `apps/api` (NestJS + Prisma + PostgreSQL) → `apps/web` (Next.js 15).

---

## Bootstrap sequence (every session)

Do this in order before implementing:

1. **This file** (`AGENTS.md`) — rules and document map.
2. **[docs/PROGRESS.md](docs/PROGRESS.md)** — current phase, branch, gate, backlog, **decision log** (latest product rules win over memory).
3. **Module handoff** (if touching that module) — e.g. [docs/PCO_MODULE.md](docs/PCO_MODULE.md).
4. **[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)** — read **only the sections you need** (architecture, module spec, §25 delivery plan). Do not guess requirements.
5. **Existing code** — find the nearest similar feature and mirror its patterns (see [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)).
6. **[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)** — how to write code (read before implementing).
7. **[docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)** — if running, migrating, or debugging local dev.

**Current focus** (phase, branch, resume link) is always in the **header of `docs/PROGRESS.md`** — do not rely on this file for branch names.

---

## Document map

| File | Purpose | When to read |
|------|---------|--------------|
| [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Full SRS + architecture + §25 phased delivery | New module, scope questions, money/tenancy/partners |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Gate status, test scripts, decision log, backlog | **Every session** |
| [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | DRY, tenancy, layers, finance, TypeScript, done checklist | **Before writing code** |
| [docs/PCO_MODULE.md](docs/PCO_MODULE.md) | PCO workflow, API, migrations, UAT | Any PCO work |
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | Ports, migrate, seed, troubleshooting | Local dev |
| [docs/RAILWAY_AUTODEPLOY.md](docs/RAILWAY_AUTODEPLOY.md) | Staging deploy | Deploy / Railway issues |
| [README.md](README.md) | Quick start | First-time setup |

**Authority when docs conflict:**

1. Explicit instruction in the current chat  
2. `PROGRESS.md` **decision log** (newest dated entry for that topic)  
3. Module handoff docs (e.g. `PCO_MODULE.md`)  
4. `PROJECT_PLAN.md`  
5. Existing code  

**Do not invent** fields, endpoints, enums, or business rules not in the above.

---

## Hard rules (non-negotiable)

### Tenancy & security

- Tenant = `garageAccountId` from JWT / `RequestUser` — **never** from request body or query.
- Every tenant query includes `garageAccountId` (and `deletedAt: null` where applicable).
- JWT strategy sets Postgres RLS via `setTenantContext` — still scope queries explicitly in services.
- Controllers: `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`.
- Services: check `user.enabledModules.includes("moduleKey")` before business logic.
- UI `hasPermission()` only hides controls — **server enforces** all rules.

### Data integrity

- **Soft delete** for operational/finance records — no hard deletes from app code.
- **Audit log** (`AuditService`) on meaningful mutations (create/update/delete, finance, permissions).
- **Transactions** (`prisma.$transaction`) when multiple tables or money/stock must stay consistent.
- **Ledger**: every money event posts to ledger; follow existing invoice/ledger services — do not invent posting rules.

### Monorepo & API contract

- Shared types live in `packages/shared` — rebuild shared before `pnpm typecheck` if types changed.
- API returns DTOs via mappers — do not leak raw Prisma shapes to the web.
- Dependency direction: `shared` → `api` → `web` (never the reverse).

### Scope & quality

- Build only what the **current gate** in `PROGRESS.md` needs (YAGNI).
- **Smallest correct diff** — extend existing modules; do not refactor unrelated code.
- Match naming, folder layout, and patterns of the nearest similar feature.
- Validate at API boundary (`class-validator` DTOs); clear `BadRequestException` / `ForbiddenException` messages.
- No `as any` to green the build. No secrets or `dist/` in commits.

---

## Code patterns (copy, don’t reinvent)

**New entity module** — mirror **customers**:

```
apps/api/src/customers/     → module, service, controller, dto/, mapper
apps/web/src/components/... → page + list/detail components
packages/shared/src/        → *-types.ts, permissions in permission-matrix
```

**Typical service guards:**

```typescript
private garageId(user: RequestUser): string {
  if (!user.garageAccountId) throw new ForbiddenException("No garage context");
  if (!user.enabledModules.includes("customers")) {
    throw new ForbiddenException("Customers module is not enabled");
  }
  return user.garageAccountId;
}
```

**Workshop view/write rules:** `packages/shared/src/workshop-access.ts` — use these helpers, don’t duplicate permission logic.

**Web API calls:** `apps/web/src/lib/api-client.ts` → `apiFetch<T>()`.

**Local ports:** web `3011`, API `4000`, Postgres `5433` (see `LOCAL_DEVELOPMENT.md`).

---

## Definition of done

Before marking work complete:

- [ ] Requirements traced to `PROGRESS.md` / `PROJECT_PLAN.md` / module doc — nothing invented
- [ ] `garageAccountId` + module enabled on all tenant operations
- [ ] Permissions on all new routes
- [ ] Audit + transaction where applicable
- [ ] Shared types updated if API shape changed; migration if schema changed
- [ ] `pnpm typecheck` passes (build `packages/shared` first if needed)
- [ ] Diff is minimal and matches existing conventions
- [ ] Decision log updated in `PROGRESS.md` if product rules changed

---

## Session prompts (for product owner)

### Quick start: `/context` (recommended)

In Cursor chat, type **`/context`** — same idea as Claude’s context load.

| You type | What happens |
|----------|----------------|
| `/context` | Agent reads `AGENTS.md` + `PROGRESS.md` + `CODING_STANDARDS.md`, confirms current gate, waits for your task |
| `/context pco` | Above + `docs/PCO_MODULE.md` |
| `/context fix duplicate VRM on PCO` | Bootstrap, then runs that task |
| `/context pco fix duplicate VRM` | Bootstrap + PCO doc, then runs that task |

Command file: [`.cursor/commands/context.md`](.cursor/commands/context.md) (project-wide, in git).

### Manual opener (any AI / no slash commands)

```text
Read AGENTS.md and follow its bootstrap sequence.
Read docs/PROGRESS.md (header, decision log, current gate).
If this touches [module], read docs/[MODULE]_MODULE.md.
Do not invent requirements — verify against docs and existing code.
Then: [your task]
```

**New phase / large feature:**

```text
Read AGENTS.md, docs/PROGRESS.md, and the relevant sections of docs/PROJECT_PLAN.md (§25 + module spec).
Mirror the customers module pattern unless the plan says otherwise.
Then: [your task]
```

**Bug fix:**

```text
Read AGENTS.md and docs/PROGRESS.md decision log for [area].
Reproduce from existing code; minimal fix only.
Then: [describe bug]
```

---

## What not to do

- Don’t read all 1,000+ lines of `PROJECT_PLAN.md` every time — read targeted sections.
- Don’t add Phase 10+ features while an earlier gate is still ⏳.
- Don’t put business rules only in React — server owns validation.
- Don’t add global enums without checking impact on ledger/invoices (see `PcoBookingSlotPaymentMethod` vs `PaymentMethod` lesson).
- Don’t assume the API is running stale code — rebuild and restart after API changes.

---

## Cursor rules

Always-on coding constraints are in [`.cursor/rules/mygaragepro.mdc`](.cursor/rules/mygaragepro.mdc) (loaded automatically in Cursor).

Slash command **`/context`** loads project docs — see [`.cursor/commands/context.md`](.cursor/commands/context.md).
