-- CreateTable
CREATE TABLE "garage_role_permission" (
    "id" UUID NOT NULL,
    "garage_account_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "garage_role_permission_garage_account_id_role_idx" ON "garage_role_permission"("garage_account_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "garage_role_permission_garage_account_id_role_permission_key" ON "garage_role_permission"("garage_account_id", "role", "permission");

-- AddForeignKey
ALTER TABLE "garage_role_permission" ADD CONSTRAINT "garage_role_permission_garage_account_id_fkey" FOREIGN KEY ("garage_account_id") REFERENCES "garage_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
