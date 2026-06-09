-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PART_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE', 'OTHER');

-- AlterEnum
ALTER TYPE "LedgerSourceModule" ADD VALUE 'INVOICES';

-- AlterTable
ALTER TABLE "garage_account" ADD COLUMN "invoice_next_seq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ledger_entry" ADD COLUMN "customer_id" UUID,
ADD COLUMN "customer_payment_id" UUID;

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATE,
    "due_date" DATE,
    "amount_net" DECIMAL(14,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_gross" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit_price_net" DECIMAL(14,2) NOT NULL,
    "vat_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount_net" DECIMAL(14,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_gross" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payment" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "payment_account_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "value_date" DATE NOT NULL,
    "method" "PaymentMethod" DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_garage_account_id_invoice_number_key" ON "invoice"("garage_account_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_garage_account_id_customer_id_status_idx" ON "invoice"("garage_account_id", "customer_id", "status");

-- CreateIndex
CREATE INDEX "invoice_garage_account_id_status_idx" ON "invoice"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "invoice_line_invoice_id_idx" ON "invoice_line"("invoice_id");

-- CreateIndex
CREATE INDEX "customer_payment_garage_account_id_customer_id_idx" ON "customer_payment"("garage_account_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_payment_garage_account_id_value_date_idx" ON "customer_payment"("garage_account_id", "value_date");

-- CreateIndex
CREATE INDEX "payment_allocation_invoice_id_idx" ON "payment_allocation"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_allocation_payment_id_idx" ON "payment_allocation"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_customer_payment_id_key" ON "ledger_entry"("customer_payment_id");

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_customer_payment_id_fkey" FOREIGN KEY ("customer_payment_id") REFERENCES "customer_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "customer_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
