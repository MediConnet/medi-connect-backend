-- Migration: Fix CASCADE DELETE for complete user deletion
-- This ensures that when a user is deleted, ALL related data is removed

-- 1. Fix appointments foreign keys
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_fkey 
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_provider_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_clinic_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- 2. Fix medical_history foreign keys
ALTER TABLE medical_history DROP CONSTRAINT IF EXISTS medical_history_patient_id_fkey;
ALTER TABLE medical_history ADD CONSTRAINT medical_history_patient_id_fkey 
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE medical_history DROP CONSTRAINT IF EXISTS medical_history_provider_id_fkey;
ALTER TABLE medical_history ADD CONSTRAINT medical_history_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

ALTER TABLE medical_history DROP CONSTRAINT IF EXISTS medical_history_appointment_id_fkey;
ALTER TABLE medical_history ADD CONSTRAINT medical_history_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- 3. Fix reviews foreign keys
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_patient_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_patient_id_fkey 
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_appointment_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_branch_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES provider_branches(id) ON DELETE CASCADE;

-- 4. Fix payments foreign keys
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_appointment_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_clinic_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_clinic_id_fkey 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payout_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_payout_id_fkey 
  FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE;

-- 5. Fix payouts foreign keys
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_provider_id_fkey;
ALTER TABLE payouts ADD CONSTRAINT payouts_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- 6. Fix patient_favorites foreign keys
ALTER TABLE patient_favorites DROP CONSTRAINT IF EXISTS patient_favorites_branch_id_fkey;
ALTER TABLE patient_favorites ADD CONSTRAINT patient_favorites_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES provider_branches(id) ON DELETE CASCADE;

-- 7. Fix clinic_doctors foreign key to users (should allow NULL on delete, not cascade)
ALTER TABLE clinic_doctors DROP CONSTRAINT IF EXISTS clinic_doctors_user_id_fkey;
ALTER TABLE clinic_doctors ADD CONSTRAINT clinic_doctors_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
