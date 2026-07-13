-- AlterEnum
ALTER TYPE "PcoBookingStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "pco_booking" ADD COLUMN "failure_reason" TEXT;
ALTER TABLE "pco_booking" ADD COLUMN "failed_at" TIMESTAMP(3);
ALTER TABLE "pco_booking" ADD COLUMN "retest_booking_id" UUID;
ALTER TABLE "pco_booking" ADD COLUMN "retest_charge_reference" TEXT;

-- AddForeignKey
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_retest_booking_id_fkey"
  FOREIGN KEY ("retest_booking_id") REFERENCES "pco_booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pco_booking_retest_booking_id_key" ON "pco_booking"("retest_booking_id");
