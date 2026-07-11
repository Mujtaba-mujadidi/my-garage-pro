# MyGaragePro — Coding standards

**Audience:** Developers and AI agents writing code in this repo.  
**Companion docs:** [AGENTS.md](../AGENTS.md) (bootstrap), [PROJECT_PLAN.md](PROJECT_PLAN.md) (requirements), [PROGRESS.md](PROGRESS.md) (current gate + decisions).

Apply these standards **whenever you implement or change code**. Requirements come from docs and chat — standards govern **how** you write that code.

---

## 1. Verify first — do not invent

| Do | Don't |
|----|--------|
| Read `PROGRESS.md` decision log and relevant module doc before changing behaviour | Assume how a feature works from memory or generic SaaS patterns |
| Grep for similar features (e.g. customers → suppliers → PCO) | Invent endpoints, fields, enums, or business rules |
| Read existing service/controller before adding a parallel path | Fill requirement gaps with guessed product logic |
| Ask when ambiguous | Ship “it should work” without typecheck or reading the diff |

**Rule:** If it is not in the plan, decision log, module handoff, or existing code — **do not build it** until agreed.

---

## 2. Scope: smallest correct change

- Fix or build **only** what the task and current gate need (YAGNI).
- Prefer extending an existing module over a new abstraction layer.
- No drive-by refactors, renames, or “while I’m here” cleanups.
- One logical concern per PR when possible (aligns with gated phases in `PROJECT_PLAN.md` §25).

**Anti-pattern:** 100-line refactor while fixing a 5-line bug.

---

## 3. DRY — at the right level

**DRY = don’t repeat yourself**, not “one framework for everything.”

| Good | Bad |
|------|-----|
| Shared types in `packages/shared` | Copy-pasting interfaces into web and API |
| Reuse `apiFetch`, `Modal`, `TableRowActionsMenu` | Abstracting two similar forms into a generic CRUD generator |
| One permission matrix, one module list | Mega-helper used in one place |
| `workshop-access.ts` helpers for repair/bodywork UI rules | Duplicating permission strings across components |

**Extract when:** the same rule or shape appears in **3+ places**, or duplication would cause **drift** (permissions, money, tenancy, status transitions).

---

## 4. KISS & explicit over clever

- Clear names: `scheduleBooking`, `findOpenBookingByVrm` — not `handleTransition`.
- Obvious control flow over meta-programming.
- Comments only for **non-obvious business rules** (e.g. “PCO expiry = previous expiry + 1 year, not completion date”).
- No clever one-liners that need a comment to explain.

---

## 5. Follow existing conventions

Before writing new code:

1. Find the **nearest similar feature** (usually **customers** for a new entity).
2. Mirror **folder layout**, naming, guards, audit, and mapper style.
3. Match import style, error types, and UI patterns in that area.

New code should read as if written by the same author as the rest of the repo.

**New entity checklist:**

```
apps/api/src/<module>/     module.ts, service.ts, controller.ts, dto/, *.mapper.ts
apps/web/src/...           page + components
packages/shared/src/       *-types.ts, permissions in permission-matrix / modules.ts
```

---

## 6. Single source of truth

| Concern | Source of truth |
|---------|-----------------|
| Database shape | `apps/api/prisma/schema.prisma` + migrations |
| Permissions / modules | `packages/shared` (`permissions.ts`, `permission-matrix.ts`, `modules.ts`) |
| Product rules | `PROGRESS.md` decision log → module docs → `PROJECT_PLAN.md` |
| API contract | DTOs + mappers + shared types (not duplicated ad hoc in web) |

If two places define the same thing, one will eventually be wrong.

---

## 7. Monorepo & dependencies

```
packages/shared  →  apps/api  →  apps/web
```

- Web and API import from `@mygaragepro/shared` — never copy-paste shared types.
- Shared must **not** import from api or web.
- Web must **not** import Prisma client types.
- After changing shared types: `pnpm --filter @mygaragepro/shared build`, then typecheck api/web.
- Do not commit `apps/api/dist/` or secrets (`.env`).

---

## 8. Multi-tenancy (mandatory)

- Tenant = `garageAccountId` from `RequestUser` / JWT — **never** from request body, query, or client-sent headers.
- Every read/write on tenant data: `where: { garageAccountId, … }` and `deletedAt: null` where soft delete applies.
- JWT strategy sets RLS via `PrismaService.setTenantContext` — **still** scope explicitly in services.
- Super Admin paths are separate; do not bypass tenancy for normal garage routes.

```typescript
// ✅ GOOD
private garageId(user: RequestUser): string {
  if (!user.garageAccountId) throw new ForbiddenException("No garage context");
  if (!user.enabledModules.includes("customers")) {
    throw new ForbiddenException("Customers module is not enabled");
  }
  return user.garageAccountId;
}

// ❌ BAD — trusting client
create(@Body() dto: CreateDto) {
  return this.prisma.customer.create({ data: { garageAccountId: dto.garageAccountId } });
}
```

---

## 9. Authorization (mandatory)

**API**

- Controller class: `@UseGuards(PermissionsGuard)`.
- Each route: `@RequirePermissions("module.read")` or `@RequirePermissions("module.write")` (or `@RequireAnyPermissions` where ledger already does).
- Service: module enabled check + tenancy.

**Web**

- `hasPermission("module.write")` and `session.enabledModules.includes("module")` to show/hide UI.
- **Never** rely on UI alone — server must reject unauthorized calls.

**Workshop (repair / bodywork)**

- Use `packages/shared/src/workshop-access.ts` — do not re-encode view vs write rules inline.

---

## 10. Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Controller** | HTTP, decorators, delegate to service |
| **Service** | Business rules, transactions, tenancy, audit |
| **Prisma** | Data access — avoid scattering business logic in raw queries |
| **Mapper** | Entity → DTO (money/decimals converted consistently) |
| **Web components** | Display, forms, `apiFetch` — not authoritative business rules |

Money, stock, booking state machines, approval flows → **always server**.

---

## 11. Data integrity

### Soft delete

- Use `deletedAt` / `deletedById` — no hard `delete()` on operational or finance records from app code.
- Lists default to active records unless `includeDeleted` is an intentional, permissioned feature.

### Audit

Log via `AuditService` for mutations that matter: create/update/delete, permissions, settings, finance, stock adjustments.

```typescript
await this.audit.log({
  action: "customer.updated",
  garageAccountId,
  userId: user.id,
  entityType: "Customer",
  entityId: customer.id,
  metadata: { fields: ["name"] },
});
```

### Transactions

Use `prisma.$transaction` when:

- Multiple tables must succeed or fail together
- Money + ledger + invoice
- Stock movement + job line
- Any invariant spans rows

### Idempotency / state machines

- Check **current status** before transitions (`PENDING` → `ACTIVE`, invoice draft → sent).
- Reject illegal transitions with specific `BadRequestException` messages.
- Guard double-submit: disable UI buttons + server-side status check.

---

## 12. Finance & ledger

- Every money event posts to the **central ledger** (see `PROJECT_PLAN.md` §3.2).
- Copy patterns from `invoices.service.ts` and `ledger.service.ts` — do not invent posting rules.
- Posted entries are not casually edited; reversals/voids follow existing flows and audit.
- Payment allocation must balance; split payments must cover allocations.
- **Enums:** before adding a value to a **global** enum (`PaymentMethod`, `LedgerSourceModule`, etc.), grep the whole repo for impact. Module-specific enums belong on module models (e.g. `PcoBookingSlotPaymentMethod`).

---

## 13. API design

### DTOs & validation

- Request bodies: `class-validator` DTOs on `@Body()`.
- Use `@IsOptional()`, `@IsEnum()`, `@IsNumber({ maxDecimalPlaces: 2 })` as appropriate.
- Validate business rules in the service after DTO shape validation.

### Errors

- `ForbiddenException` — no permission or module disabled.
- `NotFoundException` — row missing or wrong tenant.
- `BadRequestException` — invalid state or input; message must be **actionable** for UAT.

```typescript
// ✅ GOOD
throw new BadRequestException("This VRM already has an open booking on To book");

// ❌ BAD
throw new BadRequestException("Invalid request");
```

### Responses

- Return DTOs from mappers — not raw Prisma entities with relations unless existing endpoints already do for that module (then stay consistent).

---

## 14. Database & migrations

- Schema changes: edit `schema.prisma` → `npx prisma migrate dev` with a **descriptive** migration name.
- One logical schema change per migration when possible.
- PostgreSQL enums: plan additive migrations carefully (see existing PCO migrations for split enum patterns).
- Seed updates in `prisma/seed.ts` when new permissions or demo data are required.
- Run `prisma generate` after schema changes.

---

## 15. Shared types & constants

- API shapes consumed by web: define in `packages/shared/src/*-types.ts`, export from `index.ts`.
- Permission slugs, module keys, status unions: shared constants — not string literals scattered in five files.
- Document domain constants (e.g. TfL slot fee vs customer charge) in shared or module doc, not magic numbers in UI only.

---

## 16. Web (Next.js)

- Fetch via `apiFetch<T>()` from `apps/web/src/lib/api-client.ts`.
- Surface API errors to the user (`ApiError` message) — do not swallow failures.
- Permissions control visibility; server controls enforcement.
- Reuse existing layout, tables, modals, and form patterns.
- Prefer **server response as truth** for money/stock/bookings over optimistic UI.
- Dates/money: follow existing helpers (`formatGbp`, ISO date fields) in the module you are touching.

---

## 17. TypeScript

- Strict typing — no `as any` to silence errors.
- Prefer shared types over inline duplicates.
- `readonly` and `as const` where the codebase already uses them.
- Narrow unions for status fields — align with Prisma enums and shared types.

---

## 18. Testing

- Add tests when requested or when behaviour is high-risk (payment allocation, tenancy isolation, ledger posting).
- Skip trivial tests that only assert the framework renders.
- Manual gate test scripts in `PROGRESS.md` and module docs are part of QA — run them when touching that module.

---

## 19. Git & commits

- Do not commit unless the user asks.
- Never commit `.env`, credentials, or `dist/`.
- Keep commits focused; message explains **why**, not only what.

---

## 20. Local dev habits

- Web: `3011`, API: `4000`, Postgres: `5433` — see [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).
- After API changes: rebuild/restart API — stale dist causes phantom `Cannot GET /...` errors.
- `pnpm typecheck` before considering work done (build shared first if needed).

---

## 21. AI-specific pitfalls (learned on this project)

| Pitfall | Prevention |
|---------|------------|
| Inventing PCO/ledger fields | Read decision log + `PCO_MODULE.md` |
| Global enum breaks invoices | Module-specific enum on module model |
| Business rule only in React | Duplicate rule in service |
| Duplicate VRM / open bookings | Server validation + list exclusion |
| Huge unrelated diff | Re-read task; minimize scope |
| Stale API | Restart after `apps/api` changes |

---

## 22. Definition of done (coding)

Before marking implementation complete:

- [ ] Requirements traced to docs — nothing invented
- [ ] Tenancy + module enabled on all operations
- [ ] `@RequirePermissions` on new routes
- [ ] Soft delete respected; audit on sensitive mutations
- [ ] Transaction used if multiple tables / money / stock
- [ ] Shared types + migration if API/schema changed
- [ ] Matches nearest existing module’s patterns
- [ ] Clear error messages for invalid user actions
- [ ] `pnpm typecheck` passes
- [ ] `PROGRESS.md` decision log updated if product rules changed

---

## Quick reference card

```
VERIFY  → PROGRESS + module doc + grep similar code
SCOPE   → smallest diff, current gate only
DRY     → shared types & existing components, not premature abstraction
TENANT  → garageAccountId from user, never client
AUTH    → RequirePermissions + enabledModules; UI is not enough
DATA    → soft delete, audit, $transaction
MONEY   → ledger service patterns; careful with enums
SHIP    → typecheck, no dist/secrets, decision log if rules changed
```
