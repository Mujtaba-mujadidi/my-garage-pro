CREATE TYPE "PcoBookingSlotPaymentMethod" AS ENUM (
  'BANK_TRANSFER',
  'CARD',
  'CASH',
  'CHEQUE',
  'OTHER',
  'CUSTOMER_PAID'
);

ALTER TABLE "pco_booking"
  ALTER COLUMN "booking_payment_method" TYPE "PcoBookingSlotPaymentMethod"
  USING ("booking_payment_method"::text)::"PcoBookingSlotPaymentMethod";
