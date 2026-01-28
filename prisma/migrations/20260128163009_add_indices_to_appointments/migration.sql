-- CreateIndex
CREATE INDEX "appointments_provider_id_idx" ON "appointments"("provider_id");

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_for_idx" ON "appointments"("scheduled_for");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");
