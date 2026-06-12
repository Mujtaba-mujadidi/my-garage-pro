-- Link stock COGS ledger entries to job part / tyre usages for automatic reversal on return.
ALTER TABLE "ledger_entry" ADD COLUMN "job_part_usage_id" UUID;
ALTER TABLE "ledger_entry" ADD COLUMN "job_tyre_usage_id" UUID;

CREATE UNIQUE INDEX "ledger_entry_job_part_usage_id_key" ON "ledger_entry"("job_part_usage_id");
CREATE UNIQUE INDEX "ledger_entry_job_tyre_usage_id_key" ON "ledger_entry"("job_tyre_usage_id");

ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_job_part_usage_id_fkey" FOREIGN KEY ("job_part_usage_id") REFERENCES "job_part_usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_job_tyre_usage_id_fkey" FOREIGN KEY ("job_tyre_usage_id") REFERENCES "job_tyre_usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
