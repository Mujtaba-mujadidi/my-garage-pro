-- CreateEnum
CREATE TYPE "RepairJobStatus" AS ENUM ('NEW', 'QUOTE_SENT', 'APPROVED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepairJobSource" AS ENUM ('CUSTOMER', 'INTERNAL', 'RENTAL', 'WARRANTY');

-- CreateEnum
CREATE TYPE "RepairTaskStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LedgerSourceModule" ADD VALUE 'REPAIR';

-- AlterTable
ALTER TABLE "garage_account" ADD COLUMN "repair_next_seq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN "repair_job_id" UUID;

-- AlterTable
ALTER TABLE "ledger_entry" ADD COLUMN "repair_job_id" UUID;

-- CreateTable
CREATE TABLE "repair_job" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "job_number" TEXT NOT NULL,
    "status" "RepairJobStatus" NOT NULL DEFAULT 'NEW',
    "source" "RepairJobSource" NOT NULL DEFAULT 'CUSTOMER',
    "vehicle_registration" TEXT,
    "vehicle_make" TEXT,
    "vehicle_model" TEXT,
    "customer_concern" TEXT,
    "notes" TEXT,
    "vat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "vat_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_task" (
    "id" UUID NOT NULL,
    "repair_job_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RepairTaskStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignee_id" UUID,
    "labour_hours" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "labour_rate_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "parts_description" TEXT,
    "parts_quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "parts_unit_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repair_job_garage_account_id_status_idx" ON "repair_job"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "repair_job_garage_account_id_customer_id_idx" ON "repair_job"("garage_account_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "repair_job_garage_account_id_job_number_key" ON "repair_job"("garage_account_id", "job_number");

-- CreateIndex
CREATE INDEX "repair_task_repair_job_id_idx" ON "repair_task"("repair_job_id");

-- CreateIndex
CREATE INDEX "repair_task_assignee_id_idx" ON "repair_task"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_repair_job_id_key" ON "invoice"("repair_job_id");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_task" ADD CONSTRAINT "repair_task_repair_job_id_fkey" FOREIGN KEY ("repair_job_id") REFERENCES "repair_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_task" ADD CONSTRAINT "repair_task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
