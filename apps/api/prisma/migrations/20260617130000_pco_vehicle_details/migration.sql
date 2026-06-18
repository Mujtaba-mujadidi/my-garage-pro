-- Default new PCO bookings to To book (pending scheduling)
ALTER TABLE "pco_booking" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Optional vehicle details for PCO records
ALTER TABLE "pco_vehicle" ADD COLUMN IF NOT EXISTS "make" TEXT;
ALTER TABLE "pco_vehicle" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "pco_vehicle" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "pco_vehicle" ADD COLUMN IF NOT EXISTS "fuel_type" TEXT;
ALTER TABLE "pco_vehicle" ADD COLUMN IF NOT EXISTS "seat_count" INTEGER;
