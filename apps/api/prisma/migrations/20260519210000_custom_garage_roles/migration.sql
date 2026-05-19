-- Step 1: add STAFF enum value only (must be committed before it can be used in SQL).
-- Safe if a previous deploy partially added STAFF then rolled back the rest.

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE 'STAFF';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
