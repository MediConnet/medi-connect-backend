-- Add payment system fields to payments table
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_source" VARCHAR(50);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "clinic_id" UUID;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(6);

-- Add foreign key for clinic_id in payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinic_id_fkey" 
  FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Add payment system fields to payouts table
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "payout_type" VARCHAR(50);
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(6);

-- Create clinic_payment_distributions table
CREATE TABLE IF NOT EXISTS "clinic_payment_distributions" (
  "id" UUID PRIMARY KEY,
  "payout_id" UUID NOT NULL,
  "doctor_id" UUID NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "percentage" DECIMAL(5, 2),
  "status" VARCHAR(50) NOT NULL,
  "paid_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_payment_distributions_payout_id_fkey" 
    FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "clinic_payment_distributions_doctor_id_fkey" 
    FOREIGN KEY ("doctor_id") REFERENCES "clinic_doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create indexes for clinic_payment_distributions
CREATE INDEX IF NOT EXISTS "clinic_payment_distributions_payout_id_idx" ON "clinic_payment_distributions"("payout_id");
CREATE INDEX IF NOT EXISTS "clinic_payment_distributions_doctor_id_idx" ON "clinic_payment_distributions"("doctor_id");
CREATE INDEX IF NOT EXISTS "clinic_payment_distributions_status_idx" ON "clinic_payment_distributions"("status");

-- Create doctor_bank_accounts table
CREATE TABLE IF NOT EXISTS "doctor_bank_accounts" (
  "id" UUID PRIMARY KEY,
  "doctor_id" UUID NOT NULL UNIQUE,
  "bank_name" VARCHAR(255) NOT NULL,
  "account_number" VARCHAR(255) NOT NULL,
  "account_type" VARCHAR(50) NOT NULL,
  "account_holder" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_bank_accounts_doctor_id_fkey" 
    FOREIGN KEY ("doctor_id") REFERENCES "clinic_doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create index for doctor_bank_accounts
CREATE INDEX IF NOT EXISTS "doctor_bank_accounts_doctor_id_idx" ON "doctor_bank_accounts"("doctor_id");
