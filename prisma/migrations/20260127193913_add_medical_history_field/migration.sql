-- AlterTable
ALTER TABLE "medical_history" ADD COLUMN     "appointmentsId" UUID;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_appointmentsId_fkey" FOREIGN KEY ("appointmentsId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
