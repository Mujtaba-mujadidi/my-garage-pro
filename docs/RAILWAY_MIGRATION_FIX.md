# Fix failed migration on Railway (P3009)

If deploy fails with:

```text
The `20260519210000_custom_garage_roles` migration ... failed
Error: P3009
```

Or:

```text
Following migration have failed:
20260519220000_custom_garage_roles_tables
```

## Cause

PostgreSQL cannot use a new enum value (`STAFF`) in the **same transaction** as `ALTER TYPE ... ADD VALUE`. The migration is now split into two steps in the repo.

## Fix (one time on Railway)

### 1. Mark the failed migration as rolled back

Use the **exact name** from `prisma migrate status` (failed migration line).

**Locally** (with `DATABASE_URL` = Postgres `DATABASE_PUBLIC_URL` from Railway):

```bash
cd apps/api
export DATABASE_URL="your-railway-postgres-url"

# If the first step failed:
pnpm exec prisma migrate resolve --rolled-back 20260519210000_custom_garage_roles

# If the second step failed (most common now):
pnpm exec prisma migrate resolve --rolled-back 20260519220000_custom_garage_roles_tables
```

### 2. Push the fixed migrations and redeploy

After pulling the latest `main` (split migrations + idempotent SQL):

```bash
git pull origin main
# Railway auto-deploys, or trigger Redeploy on API service
```

`prisma migrate deploy` will run:

1. `20260519210000_custom_garage_roles` — adds `STAFF` enum only  
2. `20260519220000_custom_garage_roles_tables` — tables + data  

### 3. Confirm API is up

Open `https://YOUR-API-DOMAIN/health`

---

## If step 1 says migration is not failed

If the failed row was already removed, run deploy only:

```bash
pnpm exec prisma migrate deploy
```

## Failed migration: `demo_garage_modules_and_admin` (wrong table name)

If API deploy fails after commit `df94e90` with SQL error on relation `"user"`:

```text
relation "user" does not exist
```

The fix uses table `users`. Mark the failed migration rolled back, then redeploy API:

```bash
cd apps/api
export DATABASE_URL="<Railway Postgres URL>"
pnpm exec prisma migrate resolve --rolled-back 20260609170000_demo_garage_modules_and_admin
```

Push includes the corrected SQL; `migrate deploy` on the next API start will apply it.

---

## If deploy still fails (partial DB state)

In **Postgres → Query** (or `psql`), check:

```sql
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 5;
```

```sql
-- Should exist after success:
SELECT COUNT(*) FROM garage_role;
```

If `garage_role` exists but migrations are stuck, ask for support with the query output — do not drop production tables without a backup.
