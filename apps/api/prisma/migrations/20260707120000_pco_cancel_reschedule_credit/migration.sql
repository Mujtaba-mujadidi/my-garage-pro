-- AlterEnum
ALTER TYPE "PcoBookingSlotPaidBy" ADD VALUE 'TFL_CREDIT';

-- CreateEnum
CREATE TYPE "PcoSlotFeeDisposition" AS ENUM ('NOT_APPLICABLE', 'RETAINED', 'REFUND_REQUESTED');
CREATE TYPE "PcoSlotCreditStatus" AS ENUM ('NOT_APPLICABLE', 'AVAILABLE', 'APPLIED');

-- AlterTable
ALTER TABLE "pco_booking" ADD COLUMN "slot_credit_source_booking_id" UUID;
ALTER TABLE "pco_booking" ADD COLUMN "slot_fee_disposition" "PcoSlotFeeDisposition";
ALTER TABLE "pco_booking" ADD COLUMN "slot_credit_status" "PcoSlotCreditStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE "pco_booking" ADD COLUMN "cancellation_note" TEXT;
ALTER TABLE "pco_booking" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "pco_booking" ADD COLUMN "cancelled_by_id" UUID;
ALTER TABLE "pco_booking" ADD COLUMN "rescheduled_from_booking_id" UUID;
ALTER TABLE "pco_booking" ADD COLUMN "rescheduled_to_booking_id" UUID;

-- AddForeignKey
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_slot_credit_source_booking_id_fkey"
  FOREIGN KEY ("slot_credit_source_booking_id") REFERENCES "pco_booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_cancelled_by_id_fkey"
  FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_rescheduled_from_booking_id_fkey"
  FOREIGN KEY ("rescheduled_from_booking_id") REFERENCES "pco_booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pco_booking" ADD CONSTRAINT "pco_booking_rescheduled_to_booking_id_fkey"
  FOREIGN KEY ("rescheduled_to_booking_id") REFERENCES "pco_booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pco_booking_rescheduled_to_booking_id_key" ON "pco_booking"("rescheduled_to_booking_id");
