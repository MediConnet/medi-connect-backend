-- Migración: Permitir médicos independientes guardar datos bancarios
-- Cambia doctor_bank_accounts.doctor_id para referenciar users.id en lugar de clinic_doctors.id

-- 1. Eliminar FK y unique constraint existentes
ALTER TABLE "doctor_bank_accounts" DROP CONSTRAINT IF EXISTS "doctor_bank_accounts_doctor_id_fkey";
ALTER TABLE "doctor_bank_accounts" DROP CONSTRAINT IF EXISTS "doctor_bank_accounts_doctor_id_key";

-- 2. Renombrar columna vieja y crear nueva
ALTER TABLE "doctor_bank_accounts" RENAME COLUMN "doctor_id" TO "clinic_doctor_id";
ALTER TABLE "doctor_bank_accounts" ADD COLUMN "user_id" UUID;

-- 3. Migrar datos existentes: obtener user_id desde clinic_doctors
UPDATE "doctor_bank_accounts" dba
SET "user_id" = cd."user_id"
FROM "clinic_doctors" cd
WHERE dba."clinic_doctor_id" = cd."id";

-- 4. Hacer user_id NOT NULL y UNIQUE
ALTER TABLE "doctor_bank_accounts" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "doctor_bank_accounts" ADD CONSTRAINT "doctor_bank_accounts_user_id_key" UNIQUE ("user_id");

-- 5. Agregar FK a users
ALTER TABLE "doctor_bank_accounts" ADD CONSTRAINT "doctor_bank_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- 6. Eliminar columna vieja
ALTER TABLE "doctor_bank_accounts" DROP COLUMN "clinic_doctor_id";

-- 7. Actualizar índice
DROP INDEX IF EXISTS "doctor_bank_accounts_doctor_id_idx";
CREATE INDEX "doctor_bank_accounts_user_id_idx" ON "doctor_bank_accounts"("user_id");
