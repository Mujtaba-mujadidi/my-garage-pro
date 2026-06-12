-- Job part order/receive flow
CREATE TYPE "JobPartSource" AS ENUM ('STOCK', 'ORDERED');

ALTER TYPE "JobPartUsageStatus" ADD VALUE 'ORDERED';
ALTER TYPE "JobPartUsageStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "job_part_usage"
  ADD COLUMN "source" "JobPartSource" NOT NULL DEFAULT 'STOCK',
  ADD COLUMN "supplier_ref" TEXT;
