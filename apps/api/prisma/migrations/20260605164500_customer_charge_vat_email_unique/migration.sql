-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "charge_vat" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "customer_garage_account_id_email_idx" ON "customer"("garage_account_id", "email");

-- Active customers: one record per email per garage (soft-deleted rows excluded)
CREATE UNIQUE INDEX "customer_garage_account_id_email_active_key"
ON "customer"("garage_account_id", "email")
WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;
