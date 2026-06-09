-- AlterTable
ALTER TABLE "repair_task" ADD COLUMN "amount_net" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "repair_task" ADD COLUMN "use_breakdown" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "repair_task_part" (
    "id" UUID NOT NULL,
    "repair_task_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit_price_net" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_task_part_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy single-part rows into repair_task_part
INSERT INTO "repair_task_part" (
    "id",
    "repair_task_id",
    "description",
    "quantity",
    "unit_price_net",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    "parts_description",
    "parts_quantity",
    "parts_unit_net",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "repair_task"
WHERE "parts_description" IS NOT NULL
  AND TRIM("parts_description") <> ''
  AND "parts_unit_net" > 0;

-- Backfill totals and breakdown flag from legacy labour/parts fields
UPDATE "repair_task"
SET
    "use_breakdown" = true,
    "amount_net" = ROUND(
        ("labour_hours" * "labour_rate_net") + ("parts_quantity" * "parts_unit_net"),
        2
    )
WHERE "labour_rate_net" > 0 OR "parts_unit_net" > 0;

-- Drop legacy single-part columns
ALTER TABLE "repair_task" DROP COLUMN "parts_description";
ALTER TABLE "repair_task" DROP COLUMN "parts_quantity";
ALTER TABLE "repair_task" DROP COLUMN "parts_unit_net";

-- CreateIndex
CREATE INDEX "repair_task_part_repair_task_id_idx" ON "repair_task_part"("repair_task_id");

-- AddForeignKey
ALTER TABLE "repair_task_part" ADD CONSTRAINT "repair_task_part_repair_task_id_fkey" FOREIGN KEY ("repair_task_id") REFERENCES "repair_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
