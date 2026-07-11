CREATE TYPE "PcoBookingSlotPaidBy" AS ENUM ('US', 'CUSTOMER', 'NA');

ALTER TABLE "pco_booking" ADD COLUMN "slot_paid_by" "PcoBookingSlotPaidBy";
ALTER TABLE "pco_booking" ADD COLUMN "slot_payment_account_id" UUID;
ALTER TABLE "pco_booking" ADD COLUMN "slot_ledger_entry_id" UUID;

UPDATE "pco_booking"
SET "slot_paid_by" = 'CUSTOMER'
WHERE "booking_payment_method" = 'CUSTOMER_PAID';

UPDATE "pco_booking"
SET "slot_paid_by" = 'US'
WHERE "booking_payment_method" IN ('BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE', 'OTHER');

ALTER TABLE "pco_booking" DROP COLUMN "booking_payment_method";

DROP TYPE "PcoBookingSlotPaymentMethod";

ALTER TABLE "pco_booking"
  ADD CONSTRAINT "pco_booking_slot_payment_account_id_fkey"
  FOREIGN KEY ("slot_payment_account_id") REFERENCES "payment_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pco_booking"
  ADD CONSTRAINT "pco_booking_slot_ledger_entry_id_fkey"
  FOREIGN KEY ("slot_ledger_entry_id") REFERENCES "ledger_entry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pco_booking_slot_ledger_entry_id_key" ON "pco_booking"("slot_ledger_entry_id");
