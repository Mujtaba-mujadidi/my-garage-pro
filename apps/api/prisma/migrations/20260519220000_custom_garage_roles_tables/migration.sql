-- Step 2: garage roles tables + data migration (runs after STAFF enum is committed).
-- No CREATE EXTENSION — gen_random_uuid() is built into PostgreSQL 13+ (Railway).

CREATE TABLE IF NOT EXISTS "garage_role" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "garage_role_garage_account_id_slug_key"
    ON "garage_role"("garage_account_id", "slug");
CREATE INDEX IF NOT EXISTS "garage_role_garage_account_id_idx" ON "garage_role"("garage_account_id");

DO $$ BEGIN
    ALTER TABLE "garage_role" ADD CONSTRAINT "garage_role_garage_account_id_fkey"
        FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "garage_role" ("id", "garage_account_id", "name", "slug", "is_default", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), g.id, 'Manager', 'manager', true, 0, NOW(), NOW()
FROM "garage_account" g
WHERE NOT EXISTS (
    SELECT 1 FROM "garage_role" r WHERE r."garage_account_id" = g.id AND r."slug" = 'manager'
);

INSERT INTO "garage_role" ("id", "garage_account_id", "name", "slug", "is_default", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), g.id, 'Mechanic', 'mechanic', true, 1, NOW(), NOW()
FROM "garage_account" g
WHERE NOT EXISTS (
    SELECT 1 FROM "garage_role" r WHERE r."garage_account_id" = g.id AND r."slug" = 'mechanic'
);

INSERT INTO "garage_role" ("id", "garage_account_id", "name", "slug", "is_default", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), g.id, 'Staff', 'staff', true, 2, NOW(), NOW()
FROM "garage_account" g
WHERE NOT EXISTS (
    SELECT 1 FROM "garage_role" r WHERE r."garage_account_id" = g.id AND r."slug" = 'staff'
);

-- Migrate legacy garage_role_permission (garage_account_id + role enum) → garage_role_id
DO $$ BEGIN
    -- Finish a previous failed attempt that left *_new behind
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'garage_role_permission_new'
    ) THEN
        DROP TABLE IF EXISTS "garage_role_permission";
        ALTER TABLE "garage_role_permission_new" RENAME TO "garage_role_permission";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'garage_role_permission'
          AND column_name = 'garage_account_id'
    ) THEN
        CREATE TABLE IF NOT EXISTS "garage_role_permission_new" (
            "id" UUID NOT NULL,
            "garage_role_id" UUID NOT NULL,
            "permission" TEXT NOT NULL,
            "granted" BOOLEAN NOT NULL DEFAULT true,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "garage_role_permission_new_pkey" PRIMARY KEY ("id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "garage_role_permission_new_garage_role_id_permission_key"
            ON "garage_role_permission_new"("garage_role_id", "permission");

        TRUNCATE TABLE "garage_role_permission_new";

        -- ACCOUNTANT + READ_ONLY both map to slug "staff" — aggregate to avoid duplicate keys
        INSERT INTO "garage_role_permission_new" ("id", "garage_role_id", "permission", "granted", "created_at", "updated_at")
        SELECT gen_random_uuid(), gr."id", grp."permission", BOOL_OR(grp."granted"), NOW(), NOW()
        FROM "garage_role_permission" grp
        JOIN "garage_role" gr ON gr."garage_account_id" = grp."garage_account_id"
            AND gr."slug" = CASE grp."role"::text
                WHEN 'MANAGER' THEN 'manager'
                WHEN 'MECHANIC' THEN 'mechanic'
                WHEN 'ACCOUNTANT' THEN 'staff'
                WHEN 'READ_ONLY' THEN 'staff'
                ELSE 'staff'
            END
        GROUP BY gr."id", grp."permission";

        DROP TABLE "garage_role_permission";
        ALTER TABLE "garage_role_permission_new" RENAME TO "garage_role_permission";
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'garage_role_permission'
    ) THEN
        CREATE TABLE "garage_role_permission" (
            "id" UUID NOT NULL,
            "garage_role_id" UUID NOT NULL,
            "permission" TEXT NOT NULL,
            "granted" BOOLEAN NOT NULL DEFAULT true,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "garage_role_permission_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX "garage_role_permission_garage_role_id_permission_key"
            ON "garage_role_permission"("garage_role_id", "permission");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'garage_role_permission_garage_role_id_fkey'
    ) THEN
        ALTER TABLE "garage_role_permission" ADD CONSTRAINT "garage_role_permission_garage_role_id_fkey"
            FOREIGN KEY ("garage_role_id") REFERENCES "garage_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "garage_role_id" UUID;

UPDATE "users" u
SET "garage_role_id" = gr."id"
FROM "garage_role" gr
WHERE u."garage_account_id" = gr."garage_account_id"
  AND u."garage_role_id" IS NULL
  AND u."role"::text = 'MANAGER' AND gr."slug" = 'manager';

UPDATE "users" u
SET "garage_role_id" = gr."id"
FROM "garage_role" gr
WHERE u."garage_account_id" = gr."garage_account_id"
  AND u."garage_role_id" IS NULL
  AND u."role"::text = 'MECHANIC' AND gr."slug" = 'mechanic';

UPDATE "users" u
SET "garage_role_id" = gr."id"
FROM "garage_role" gr
WHERE u."garage_account_id" = gr."garage_account_id"
  AND u."garage_role_id" IS NULL
  AND u."role"::text IN ('ACCOUNTANT', 'READ_ONLY') AND gr."slug" = 'staff';

UPDATE "users"
SET "role" = 'STAFF'
WHERE "role"::text IN ('MANAGER', 'MECHANIC', 'ACCOUNTANT', 'READ_ONLY');

DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_garage_role_id_fkey"
        FOREIGN KEY ("garage_role_id") REFERENCES "garage_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
