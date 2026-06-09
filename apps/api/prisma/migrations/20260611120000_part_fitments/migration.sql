-- CreateEnum
CREATE TYPE "PartFitmentType" AS ENUM ('UNIVERSAL', 'VEHICLE_SPECIFIC');

-- AlterTable
ALTER TABLE "part" ADD COLUMN "fitment_type" "PartFitmentType" NOT NULL DEFAULT 'UNIVERSAL';

-- CreateTable
CREATE TABLE "part_fitment" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year_from" INTEGER NOT NULL,
    "year_to" INTEGER,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_fitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_fitment_part_id_idx" ON "part_fitment"("part_id");

-- AddForeignKey
ALTER TABLE "part_fitment" ADD CONSTRAINT "part_fitment_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
