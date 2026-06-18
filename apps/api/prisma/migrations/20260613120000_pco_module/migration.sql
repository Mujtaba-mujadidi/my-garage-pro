-- AlterEnum
ALTER TYPE "LedgerSourceModule" ADD VALUE 'PCO';

-- AlterTable
ALTER TABLE "garage_account" ADD COLUMN "pco_next_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "PcoJobType" AS ENUM ('RENEWAL', 'NEW', 'ADMIN', 'LOGBOOK_EXPIRING', 'RETEST');
CREATE TYPE "PcoBookingStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PcoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "PcoVehicleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "pco_vehicle" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "vrm" TEXT NOT NULL,
    "registered_keeper" TEXT NOT NULL,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "first_registration_date" DATE NOT NULL,
    "pco_expiry_date" DATE NOT NULL,
    "logbook_expiry_date" DATE NOT NULL,
    "note" TEXT,
    "status" "PcoVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "customer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "pco_vehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pco_booking" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "pco_vehicle_id" UUID NOT NULL,
    "booking_number" TEXT NOT NULL,
    "job_type" "PcoJobType" NOT NULL,
    "job_details" TEXT,
    "status" "PcoBookingStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "PcoPriority" NOT NULL DEFAULT 'MEDIUM',
    "charge_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "booking_date" DATE,
    "booking_time" TEXT,
    "booking_centre_id" UUID,
    "client_informed" BOOLEAN NOT NULL DEFAULT false,
    "client_responded" BOOLEAN NOT NULL DEFAULT false,
    "client_informed_at" TIMESTAMP(3),
    "client_responded_at" TIMESTAMP(3),
    "booking_payment_method" "PaymentMethod",
    "created_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pco_booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pco_booking_payment" (
    "id" UUID NOT NULL,
    "pco_booking_id" UUID NOT NULL,
    "payment_account_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "value_date" DATE NOT NULL,
    "ledger_entry_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pco_booking_payment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ledger_entry" ADD COLUMN "pco_booking_id" UUID;

-- CreateIndex
CREATE INDEX "pco_vehicle_garage_account_id_vrm_status_idx" ON "pco_vehicle"("garage_account_id", "vrm", "status");
CREATE INDEX "pco_vehicle_garage_account_id_status_idx" ON "pco_vehicle"("garage_account_id", "status");
CREATE UNIQUE INDEX "pco_booking_garage_account_id_booking_number_key" ON "pco_booking"("garage_account_id", "booking_number");
CREATE INDEX "pco_booking_garage_account_id_status_idx" ON "pco_booking"("garage_account_id", "status");
CREATE INDEX "pco_booking_pco_vehicle_id_idx" ON "pco_booking"("pco_vehicle_id");
CREATE UNIQUE INDEX "pco_booking_payment_ledger_entry_id_key" ON "pco_booking_payment"("ledger_entry_id");
CREATE INDEX "pco_booking_payment_pco_booking_id_idx" ON "pco_booking_payment"("pco_booking_id");

-- AddForeignKey
ALTER TABLE "pco_vehicle" ADD CONSTRAINT "pco_vehicle_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pco_vehicle" ADD CONSTRAINT "pco_vehicle_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_pco_vehicle_id_fkey" FOREIGN KEY ("pco_vehicle_id") REFERENCES "pco_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_booking_centre_id_fkey" FOREIGN KEY ("booking_centre_id") REFERENCES "setting_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking_payment" ADD CONSTRAINT "pco_booking_payment_pco_booking_id_fkey" FOREIGN KEY ("pco_booking_id") REFERENCES "pco_booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pco_booking_payment" ADD CONSTRAINT "pco_booking_payment_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pco_booking_payment" ADD CONSTRAINT "pco_booking_payment_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking_payment" ADD CONSTRAINT "pco_booking_payment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_pco_booking_id_fkey" FOREIGN KEY ("pco_booking_id") REFERENCES "pco_booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
