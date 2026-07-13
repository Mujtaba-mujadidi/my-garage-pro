-- AlterEnum
ALTER TYPE "PcoJobType" ADD VALUE IF NOT EXISTS 'CHANGE_OF_OWNERSHIP';
ALTER TYPE "PcoJobType" ADD VALUE IF NOT EXISTS 'FULL_TEST';

-- AlterTable: PCO expiry optional (e.g. brand-new vehicles)
ALTER TABLE "pco_vehicle" ALTER COLUMN "pco_expiry_date" DROP NOT NULL;
