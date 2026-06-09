-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PartMovementType" AS ENUM ('RECEIPT', 'CONSUMPTION', 'RETURN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "JobPartUsageStatus" AS ENUM ('CONSUMED', 'RETURNED');

-- AlterEnum
ALTER TYPE "LedgerSourceModule" ADD VALUE 'PARTS';

-- CreateTable
CREATE TABLE "part" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "part_number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "quantity_on_hand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "min_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cost_price_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sell_price_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplier_id" UUID,
    "location" TEXT,
    "notes" TEXT,
    "status" "PartStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_movement" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "type" "PartMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "quantity_before" DECIMAL(12,3) NOT NULL,
    "quantity_after" DECIMAL(12,3) NOT NULL,
    "repair_job_id" UUID,
    "job_part_usage_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_part_usage" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "repair_job_id" UUID NOT NULL,
    "repair_task_id" UUID,
    "part_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "cost_price_net" DECIMAL(14,2) NOT NULL,
    "sell_price_net" DECIMAL(14,2) NOT NULL,
    "status" "JobPartUsageStatus" NOT NULL DEFAULT 'CONSUMED',
    "invoice_line_id" UUID,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_part_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_garage_account_id_status_idx" ON "part"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "part_garage_account_id_deleted_at_idx" ON "part"("garage_account_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "part_garage_account_id_part_number_key" ON "part"("garage_account_id", "part_number");

-- CreateIndex
CREATE INDEX "part_movement_part_id_idx" ON "part_movement"("part_id");

-- CreateIndex
CREATE INDEX "part_movement_garage_account_id_created_at_idx" ON "part_movement"("garage_account_id", "created_at");

-- CreateIndex
CREATE INDEX "part_movement_repair_job_id_idx" ON "part_movement"("repair_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_part_usage_invoice_line_id_key" ON "job_part_usage"("invoice_line_id");

-- CreateIndex
CREATE INDEX "job_part_usage_repair_job_id_idx" ON "job_part_usage"("repair_job_id");

-- CreateIndex
CREATE INDEX "job_part_usage_part_id_idx" ON "job_part_usage"("part_id");

-- CreateIndex
CREATE INDEX "job_part_usage_garage_account_id_status_idx" ON "job_part_usage"("garage_account_id", "status");

-- AddForeignKey
ALTER TABLE "part" ADD CONSTRAINT "part_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part" ADD CONSTRAINT "part_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_job_part_usage_id_fkey" FOREIGN KEY ("job_part_usage_id") REFERENCES "job_part_usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_repair_task_id_fkey" FOREIGN KEY ("repair_task_id") REFERENCES "repair_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
