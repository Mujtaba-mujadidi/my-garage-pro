-- Supplier credit balance and job part cost VAT
CREATE TYPE "SupplierRefundType" AS ENUM ('CREDIT', 'PAYMENT');
CREATE TYPE "SupplierCreditTransactionType" AS ENUM ('REFUND_CREDIT', 'APPLIED_PAYMENT', 'ADJUSTMENT');

ALTER TABLE "supplier"
  ADD COLUMN "credit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "job_part_usage"
  ADD COLUMN "cost_vat_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cost_amount_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "supplier_id" UUID,
  ADD COLUMN "return_refund_type" "SupplierRefundType",
  ADD COLUMN "return_payment_method" "PaymentMethod",
  ADD COLUMN "return_payment_account_id" UUID,
  ADD COLUMN "return_notes" TEXT;

ALTER TABLE "job_part_usage"
  ADD CONSTRAINT "job_part_usage_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_part_usage"
  ADD CONSTRAINT "job_part_usage_return_payment_account_id_fkey"
    FOREIGN KEY ("return_payment_account_id") REFERENCES "payment_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "supplier_credit_transaction" (
  "id" UUID NOT NULL,
  "garage_account_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "type" "SupplierCreditTransactionType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "balance_after" DECIMAL(14,2) NOT NULL,
  "job_part_usage_id" UUID,
  "ledger_entry_id" UUID,
  "notes" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_credit_transaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_credit_transaction"
  ADD CONSTRAINT "supplier_credit_transaction_garage_account_id_fkey"
    FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_transaction"
  ADD CONSTRAINT "supplier_credit_transaction_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_transaction"
  ADD CONSTRAINT "supplier_credit_transaction_job_part_usage_id_fkey"
    FOREIGN KEY ("job_part_usage_id") REFERENCES "job_part_usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_transaction"
  ADD CONSTRAINT "supplier_credit_transaction_ledger_entry_id_fkey"
    FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_transaction"
  ADD CONSTRAINT "supplier_credit_transaction_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "supplier_credit_transaction_supplier_id_created_at_idx"
  ON "supplier_credit_transaction"("supplier_id", "created_at");

CREATE INDEX "supplier_credit_transaction_garage_account_id_idx"
  ON "supplier_credit_transaction"("garage_account_id");
