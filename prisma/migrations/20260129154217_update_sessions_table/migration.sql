-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "longitude" DECIMAL(11,8);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "revoked_at" TIMESTAMP(6),
ALTER COLUMN "token" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "clinic_notifications" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN DEFAULT false,
    "data" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_clinic_notifications_clinic_created" ON "clinic_notifications"("clinic_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "clinic_notifications" ADD CONSTRAINT "clinic_notifications_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
