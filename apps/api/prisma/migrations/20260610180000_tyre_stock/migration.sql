-- CreateEnum
CREATE TYPE "TyreStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TyreCondition" AS ENUM ('NEW', 'PART_WORN');

-- CreateEnum
CREATE TYPE "TyreMovementType" AS ENUM ('RECEIPT', 'SALE', 'CONSUMPTION', 'RETURN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "JobTyreUsageStatus" AS ENUM ('CONSUMED', 'RETURNED');

-- AlterEnum
ALTER TYPE "LedgerSourceModule" ADD VALUE 'TYRES';

-- AlterEnum
ALTER TYPE "InvoiceLineType" ADD VALUE 'TYRES';

-- CreateTable
CREATE TABLE "tyre" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "sku_code" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "size" TEXT NOT NULL,
    "load_index" TEXT,
    "speed_rating" TEXT,
    "condition" "TyreCondition" NOT NULL DEFAULT 'NEW',
    "quantity_on_hand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "min_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cost_price_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sell_price_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fitting_charge_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplier_id" UUID,
    "location" TEXT,
    "notes" TEXT,
    "status" "TyreStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tyre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyre_movement" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "tyre_id" UUID NOT NULL,
    "type" "TyreMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "quantity_before" DECIMAL(12,3) NOT NULL,
    "quantity_after" DECIMAL(12,3) NOT NULL,
    "repair_job_id" UUID,
    "job_tyre_usage_id" UUID,
    "invoice_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tyre_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_tyre_usage" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "repair_job_id" UUID NOT NULL,
    "repair_task_id" UUID,
    "tyre_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "cost_price_net" DECIMAL(14,2) NOT NULL,
    "sell_price_net" DECIMAL(14,2) NOT NULL,
    "fitting_charge_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "JobTyreUsageStatus" NOT NULL DEFAULT 'CONSUMED',
    "invoice_line_id" UUID,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_tyre_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tyre_garage_account_id_sku_code_key" ON "tyre"("garage_account_id", "sku_code");

-- CreateIndex
CREATE INDEX "tyre_garage_account_id_status_idx" ON "tyre"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "tyre_garage_account_id_deleted_at_idx" ON "tyre"("garage_account_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tyre_movement_tyre_id_idx" ON "tyre_movement"("tyre_id");

-- CreateIndex
CREATE INDEX "tyre_movement_garage_account_id_created_at_idx" ON "tyre_movement"("garage_account_id", "created_at");

-- CreateIndex
CREATE INDEX "tyre_movement_repair_job_id_idx" ON "tyre_movement"("repair_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_tyre_usage_invoice_line_id_key" ON "job_tyre_usage"("invoice_line_id");

-- CreateIndex
CREATE INDEX "job_tyre_usage_repair_job_id_idx" ON "job_tyre_usage"("repair_job_id");

-- CreateIndex
CREATE INDEX "job_tyre_usage_tyre_id_idx" ON "job_tyre_usage"("tyre_id");

-- CreateIndex
CREATE INDEX "job_tyre_usage_garage_account_id_status_idx" ON "job_tyre_usage"("garage_account_id", "status");

-- AddForeignKey
ALTER TABLE "tyre" ADD CONSTRAINT "tyre_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre" ADD CONSTRAINT "tyre_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_movement" ADD CONSTRAINT "tyre_movement_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_movement" ADD CONSTRAINT "tyre_movement_tyre_id_fkey" FOREIGN KEY ("tyre_id") REFERENCES "tyre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_movement" ADD CONSTRAINT "tyre_movement_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_movement" ADD CONSTRAINT "tyre_movement_job_tyre_usage_id_fkey" FOREIGN KEY ("job_tyre_usage_id") REFERENCES "job_tyre_usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_movement" ADD CONSTRAINT "tyre_movement_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_movement" ADD CONSTRAINT "tyre_movement_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tyre_usage" ADD CONSTRAINT "job_tyre_usage_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tyre_usage" ADD CONSTRAINT "job_tyre_usage_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tyre_usage" ADD CONSTRAINT "job_tyre_usage_repair_task_id_fkey" FOREIGN KEY ("repair_task_id") REFERENCES "repair_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tyre_usage" ADD CONSTRAINT "job_tyre_usage_tyre_id_fkey" FOREIGN KEY ("tyre_id") REFERENCES "tyre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tyre_usage" ADD CONSTRAINT "job_tyre_usage_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
