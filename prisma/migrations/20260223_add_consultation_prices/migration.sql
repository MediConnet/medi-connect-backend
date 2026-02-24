-- CreateTable
CREATE TABLE IF NOT EXISTS "consultation_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "specialty_id" UUID,
    "consultation_type" VARCHAR(255) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "consultation_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "consultation_prices_provider_id_idx" ON "consultation_prices"("provider_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "consultation_prices_specialty_id_idx" ON "consultation_prices"("specialty_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "consultation_prices_is_active_idx" ON "consultation_prices"("is_active");

-- AddForeignKey
ALTER TABLE "consultation_prices" ADD CONSTRAINT "consultation_prices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consultation_prices" ADD CONSTRAINT "consultation_prices_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
