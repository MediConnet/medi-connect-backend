/*
  Warnings:

  - You are about to drop the column `appointmentsId` on the `medical_history` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "medical_history" DROP CONSTRAINT "medical_history_appointmentsId_fkey";

-- AlterTable
ALTER TABLE "medical_history" DROP COLUMN "appointmentsId",
ADD COLUMN     "appointment_id" UUID;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
