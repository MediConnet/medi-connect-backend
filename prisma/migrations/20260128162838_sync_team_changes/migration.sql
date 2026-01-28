-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "clinic_id" UUID,
ADD COLUMN     "reception_notes" TEXT,
ADD COLUMN     "reception_status" VARCHAR(50);

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "logo_url" VARCHAR(500),
    "address" TEXT NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "whatsapp" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_specialties" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "specialty" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_schedules" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "enabled" BOOLEAN DEFAULT false,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_doctors" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "specialty" VARCHAR(255),
    "office_number" VARCHAR(50),
    "profile_image_url" VARCHAR(500),
    "phone" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "is_active" BOOLEAN DEFAULT true,
    "is_invited" BOOLEAN DEFAULT true,
    "invitation_token" VARCHAR(255),
    "invitation_expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_invitations" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "invitation_token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'pending',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" UUID NOT NULL,
    "doctor_id" UUID,
    "clinic_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "enabled" BOOLEAN DEFAULT false,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "break_start" TIME(6),
    "break_end" TIME(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinics_user_id_key" ON "clinics"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_specialties_clinic_id_specialty_key" ON "clinic_specialties"("clinic_id", "specialty");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_schedules_clinic_id_day_of_week_key" ON "clinic_schedules"("clinic_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_doctors_invitation_token_key" ON "clinic_doctors"("invitation_token");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_doctors_clinic_id_email_key" ON "clinic_doctors"("clinic_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_invitations_invitation_token_key" ON "doctor_invitations"("invitation_token");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_doctor_id_clinic_id_day_of_week_key" ON "doctor_schedules"("doctor_id", "clinic_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinic_specialties" ADD CONSTRAINT "clinic_specialties_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinic_schedules" ADD CONSTRAINT "clinic_schedules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_invitations" ADD CONSTRAINT "doctor_invitations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic_doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
