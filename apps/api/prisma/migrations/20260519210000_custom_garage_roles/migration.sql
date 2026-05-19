-- Custom garage roles (Manager, Mechanic, Staff + owner-defined roles)

ALTER TYPE "UserRole" ADD VALUE 'STAFF';

CREATE TABLE "garage_role" (
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

CREATE UNIQUE INDEX "garage_role_garage_account_id_slug_key" ON "garage_role"("garage_account_id", "slug");
CREATE INDEX "garage_role_garage_account_id_idx" ON "garage_role"("garage_account_id");

ALTER TABLE "garage_role" ADD CONSTRAINT "garage_role_garage_account_id_fkey"
    FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate legacy enum-based permissions into garage roles
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

CREATE TABLE "garage_role_permission_new" (
    "id" UUID NOT NULL,
    "garage_role_id" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_role_permission_new_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_role_permission_new_garage_role_id_permission_key"
    ON "garage_role_permission_new"("garage_role_id", "permission");

-- Copy legacy grants into new role rows (manager / mechanic / staff / accountant / read_only)
INSERT INTO "garage_role_permission_new" ("id", "garage_role_id", "permission", "granted", "created_at", "updated_at")
SELECT gen_random_uuid(), gr."id", grp."permission", grp."granted", NOW(), NOW()
FROM "garage_role_permission" grp
JOIN "garage_role" gr ON gr."garage_account_id" = grp."garage_account_id"
    AND gr."slug" = CASE grp."role"::text
        WHEN 'MANAGER' THEN 'manager'
        WHEN 'MECHANIC' THEN 'mechanic'
        WHEN 'ACCOUNTANT' THEN 'staff'
        WHEN 'READ_ONLY' THEN 'staff'
        ELSE 'staff'
    END;

DROP TABLE "garage_role_permission";

ALTER TABLE "garage_role_permission_new" RENAME TO "garage_role_permission";

ALTER TABLE "garage_role_permission" ADD CONSTRAINT "garage_role_permission_garage_role_id_fkey"
    FOREIGN KEY ("garage_role_id") REFERENCES "garage_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "garage_role_id" UUID;

UPDATE "users" u
SET "garage_role_id" = gr."id"
FROM "garage_role" gr
WHERE u."garage_account_id" = gr."garage_account_id"
  AND u."role"::text = 'MANAGER' AND gr."slug" = 'manager';

UPDATE "users" u
SET "garage_role_id" = gr."id"
FROM "garage_role" gr
WHERE u."garage_account_id" = gr."garage_account_id"
  AND u."role"::text = 'MECHANIC' AND gr."slug" = 'mechanic';

UPDATE "users" u
SET "garage_role_id" = gr."id"
FROM "garage_role" gr
WHERE u."garage_account_id" = gr."garage_account_id"
  AND u."role"::text IN ('ACCOUNTANT', 'READ_ONLY') AND gr."slug" = 'staff';

UPDATE "users"
SET "role" = 'STAFF'
WHERE "role"::text IN ('MANAGER', 'MECHANIC', 'ACCOUNTANT', 'READ_ONLY');

ALTER TABLE "users" ADD CONSTRAINT "users_garage_role_id_fkey"
    FOREIGN KEY ("garage_role_id") REFERENCES "garage_role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
