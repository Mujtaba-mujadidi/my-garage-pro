-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('LABOUR', 'PARTS');

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN "vehicle_registration" TEXT;

-- AlterTable
ALTER TABLE "invoice_line" ADD COLUMN "line_type" "InvoiceLineType" NOT NULL DEFAULT 'PARTS';
