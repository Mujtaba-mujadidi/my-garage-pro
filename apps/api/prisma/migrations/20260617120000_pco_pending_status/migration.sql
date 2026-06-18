-- Add PENDING status to PCO booking workflow (car added → team books → active)
ALTER TYPE "PcoBookingStatus" ADD VALUE IF NOT EXISTS 'PENDING';
