-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('PER_JOB', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "type" "CustomerType" NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "company_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "notes" TEXT,
    "is_account_customer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_account_terms" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "credit_limit" DECIMAL(12,2),
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'PER_JOB',
    "statement_day" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_account_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_vehicle" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "colour" TEXT,
    "year" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "customer_vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_garage_account_id_type_idx" ON "customer"("garage_account_id", "type");

-- CreateIndex
CREATE INDEX "customer_garage_account_id_deleted_at_idx" ON "customer"("garage_account_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_account_terms_customer_id_key" ON "customer_account_terms"("customer_id");

-- CreateIndex
CREATE INDEX "customer_vehicle_customer_id_idx" ON "customer_vehicle"("customer_id");

-- CreateIndex
CREATE INDEX "customer_vehicle_registration_idx" ON "customer_vehicle"("registration");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_account_terms" ADD CONSTRAINT "customer_account_terms_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_vehicle" ADD CONSTRAINT "customer_vehicle_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
