# Fix failed migration on Railway (P3009)

If deploy fails with:

```text
The `20260519210000_custom_garage_roles` migration ... failed
Error: P3009
```

## Cause

PostgreSQL cannot use a new enum value (`STAFF`) in the **same transaction** as `ALTER TYPE ... ADD VALUE`. The migration is now split into two steps in the repo.

## Fix (one time on Railway)

### 1. Mark the failed migration as rolled back

**Railway → API service → Shell** (or locally with `DATABASE_URL` from Postgres):

```bash
cd apps/api
pnpm exec prisma migrate resolve --rolled-back 20260519210000_custom_garage_roles
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
