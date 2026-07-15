-- Preferred centres on request (To book) + optional TfL booking reference on schedule
ALTER TABLE "pco_booking" ADD COLUMN IF NOT EXISTS "preferred_centre_any" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pco_booking" ADD COLUMN IF NOT EXISTS "preferred_centre_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "pco_booking" ADD COLUMN IF NOT EXISTS "booking_reference" TEXT;
