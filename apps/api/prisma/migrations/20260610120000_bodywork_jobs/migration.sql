-- CreateEnum
CREATE TYPE "BodyworkJobStatus" AS ENUM ('NEW', 'QUOTE_SENT', 'APPROVED', 'AWAITING_VEHICLE', 'AWAITING_PARTS', 'ON_HOLD', 'IN_PROGRESS', 'TESTING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BodyworkJobSource" AS ENUM ('CUSTOMER', 'INSURANCE', 'INTERNAL', 'RENTAL', 'WARRANTY');

-- CreateEnum
CREATE TYPE "BodyworkTaskStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'STARTED', 'AWAITING_VEHICLE', 'AWAITING_PARTS', 'IN_PROGRESS', 'ON_HOLD', 'TESTING', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LedgerSourceModule" ADD VALUE 'BODYWORK';

-- AlterTable
ALTER TABLE "garage_account" ADD COLUMN "bodywork_next_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "bodywork_job" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "job_number" TEXT NOT NULL,
    "status" "BodyworkJobStatus" NOT NULL DEFAULT 'NEW',
    "source" "BodyworkJobSource" NOT NULL DEFAULT 'CUSTOMER',
    "vehicle_registration" TEXT,
    "vehicle_make" TEXT,
    "vehicle_model" TEXT,
    "customer_concern" TEXT,
    "panel_code" TEXT,
    "colour_code" TEXT,
    "paint_material_cost_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outsourced_cost_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "vat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "vat_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bodywork_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodywork_task" (
    "id" UUID NOT NULL,
    "bodywork_job_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "panel" TEXT,
    "status" "BodyworkTaskStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignee_id" UUID,
    "amount_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "use_breakdown" BOOLEAN NOT NULL DEFAULT false,
    "labour_hours" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "labour_rate_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bodywork_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodywork_task_part" (
    "id" UUID NOT NULL,
    "bodywork_task_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit_price_net" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bodywork_task_part_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN "bodywork_job_id" UUID;

-- AlterTable
ALTER TABLE "ledger_entry" ADD COLUMN "bodywork_job_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "bodywork_job_garage_account_id_job_number_key" ON "bodywork_job"("garage_account_id", "job_number");

-- CreateIndex
CREATE INDEX "bodywork_job_garage_account_id_status_idx" ON "bodywork_job"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "bodywork_job_garage_account_id_customer_id_idx" ON "bodywork_job"("garage_account_id", "customer_id");

-- CreateIndex
CREATE INDEX "bodywork_task_bodywork_job_id_idx" ON "bodywork_task"("bodywork_job_id");

-- CreateIndex
CREATE INDEX "bodywork_task_assignee_id_idx" ON "bodywork_task"("assignee_id");

-- CreateIndex
CREATE INDEX "bodywork_task_part_bodywork_task_id_idx" ON "bodywork_task_part"("bodywork_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_bodywork_job_id_key" ON "invoice"("bodywork_job_id");

-- AddForeignKey
ALTER TABLE "bodywork_job" ADD CONSTRAINT "bodywork_job_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodywork_job" ADD CONSTRAINT "bodywork_job_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodywork_job" ADD CONSTRAINT "bodywork_job_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodywork_task" ADD CONSTRAINT "bodywork_task_bodywork_job_id_fkey" FOREIGN KEY ("bodywork_job_id") REFERENCES "bodywork_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodywork_task" ADD CONSTRAINT "bodywork_task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodywork_task_part" ADD CONSTRAINT "bodywork_task_part_bodywork_task_id_fkey" FOREIGN KEY ("bodywork_task_id") REFERENCES "bodywork_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_bodywork_job_id_fkey" FOREIGN KEY ("bodywork_job_id") REFERENCES "bodywork_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_bodywork_job_id_fkey" FOREIGN KEY ("bodywork_job_id") REFERENCES "bodywork_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
