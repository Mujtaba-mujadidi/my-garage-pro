-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "LedgerEntryDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'CHECKED', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "LedgerSourceModule" AS ENUM ('GENERAL', 'TRANSFER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "payment_account" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentAccountType" NOT NULL,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "payment_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "payment_account_id" UUID NOT NULL,
    "direction" "LedgerEntryDirection" NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'PENDING',
    "source_module" "LedgerSourceModule" NOT NULL DEFAULT 'GENERAL',
    "value_date" DATE NOT NULL,
    "posted_at" TIMESTAMP(3),
    "amount_net" DECIMAL(14,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_gross" DECIMAL(14,2) NOT NULL,
    "category" TEXT,
    "supplier_id" UUID,
    "notes" TEXT,
    "reverses_entry_id" UUID,
    "created_by_id" UUID NOT NULL,
    "checked_by_id" UUID,
    "approved_by_id" UUID,
    "voided_by_id" UUID,
    "checked_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_account_garage_account_id_deleted_at_idx" ON "payment_account"("garage_account_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_reverses_entry_id_key" ON "ledger_entry"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "ledger_entry_garage_account_id_status_idx" ON "ledger_entry"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "ledger_entry_garage_account_id_value_date_idx" ON "ledger_entry"("garage_account_id", "value_date");

-- CreateIndex
CREATE INDEX "ledger_entry_payment_account_id_status_idx" ON "ledger_entry"("payment_account_id", "status");

-- AddForeignKey
ALTER TABLE "payment_account" ADD CONSTRAINT "payment_account_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
