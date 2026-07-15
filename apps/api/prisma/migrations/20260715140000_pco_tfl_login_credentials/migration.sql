-- TfL login credentials on PCO vehicle (password encrypted at rest)
ALTER TABLE "pco_vehicle" ADD COLUMN "tfl_login_email" TEXT;
ALTER TABLE "pco_vehicle" ADD COLUMN "tfl_login_password_enc" TEXT;
