-- AlterEnum
ALTER TYPE "PartMovementType" ADD VALUE 'SALE';

-- AlterTable
ALTER TABLE "job_part_usage" ALTER COLUMN "repair_job_id" DROP NOT NULL;

ALTER TABLE "job_part_usage" ADD COLUMN "bodywork_job_id" UUID;
ALTER TABLE "job_part_usage" ADD COLUMN "bodywork_task_id" UUID;

ALTER TABLE "part_movement" ADD COLUMN "bodywork_job_id" UUID;
ALTER TABLE "part_movement" ADD COLUMN "invoice_id" UUID;

ALTER TABLE "ledger_entry" ADD COLUMN "payment_method" "PaymentMethod";
ALTER TABLE "ledger_entry" ADD COLUMN "part_movement_id" UUID;
ALTER TABLE "ledger_entry" ADD COLUMN "tyre_movement_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_part_movement_id_key" ON "ledger_entry"("part_movement_id");
CREATE UNIQUE INDEX "ledger_entry_tyre_movement_id_key" ON "ledger_entry"("tyre_movement_id");
CREATE INDEX "job_part_usage_bodywork_job_id_idx" ON "job_part_usage"("bodywork_job_id");
CREATE INDEX "part_movement_bodywork_job_id_idx" ON "part_movement"("bodywork_job_id");

-- AddForeignKey
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_bodywork_job_id_fkey" FOREIGN KEY ("bodywork_job_id") REFERENCES "bodywork_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_part_usage" ADD CONSTRAINT "job_part_usage_bodywork_task_id_fkey" FOREIGN KEY ("bodywork_task_id") REFERENCES "bodywork_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_bodywork_job_id_fkey" FOREIGN KEY ("bodywork_job_id") REFERENCES "bodywork_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "part_movement" ADD CONSTRAINT "part_movement_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_part_movement_id_fkey" FOREIGN KEY ("part_movement_id") REFERENCES "part_movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_tyre_movement_id_fkey" FOREIGN KEY ("tyre_movement_id") REFERENCES "tyre_movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
