-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "garage_role_permission" RENAME CONSTRAINT "garage_role_permission_new_pkey" TO "garage_role_permission_pkey";

-- CreateTable
CREATE TABLE "supplier" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "vat_number" TEXT,
    "notes" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_garage_account_id_name_idx" ON "supplier"("garage_account_id", "name");

-- CreateIndex
CREATE INDEX "supplier_garage_account_id_status_idx" ON "supplier"("garage_account_id", "status");

-- CreateIndex
CREATE INDEX "supplier_garage_account_id_deleted_at_idx" ON "supplier"("garage_account_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "garage_role_permission_new_garage_role_id_permission_key" RENAME TO "garage_role_permission_garage_role_id_permission_key";
