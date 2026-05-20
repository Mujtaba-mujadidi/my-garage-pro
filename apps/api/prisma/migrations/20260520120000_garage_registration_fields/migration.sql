-- Garage registration details + first-login password reset flag
ALTER TABLE "garage_account" ADD COLUMN "director_owner_name" TEXT;
ALTER TABLE "garage_account" ADD COLUMN "address" TEXT;
ALTER TABLE "garage_account" ADD COLUMN "contact_number" TEXT;
ALTER TABLE "garage_account" ADD COLUMN "phone_number" TEXT;
ALTER TABLE "garage_account" ADD COLUMN "vat_number" TEXT;

UPDATE "garage_account"
SET
  "director_owner_name" = COALESCE("director_owner_name", 'Not set'),
  "address" = COALESCE("address", 'Not set'),
  "contact_number" = COALESCE("contact_number", 'Not set'),
  "phone_number" = COALESCE("phone_number", 'Not set')
WHERE "director_owner_name" IS NULL;

ALTER TABLE "garage_account" ALTER COLUMN "director_owner_name" SET NOT NULL;
ALTER TABLE "garage_account" ALTER COLUMN "address" SET NOT NULL;
ALTER TABLE "garage_account" ALTER COLUMN "contact_number" SET NOT NULL;
ALTER TABLE "garage_account" ALTER COLUMN "phone_number" SET NOT NULL;

ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
