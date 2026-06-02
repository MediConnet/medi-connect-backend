CREATE TABLE IF NOT EXISTS "doctor_schedules" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "doctor_schedules_doctor_id_clinic_id_day_of_week_key" 
    ON "doctor_schedules"("doctor_id", "clinic_id", "day_of_week");

ALTER TABLE "doctor_schedules" DROP CONSTRAINT IF EXISTS "doctor_schedules_doctor_id_fkey";
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" 
    FOREIGN KEY ("doctor_id") REFERENCES "clinic_doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "doctor_schedules" DROP CONSTRAINT IF EXISTS "doctor_schedules_clinic_id_fkey";
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_clinic_id_fkey" 
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
