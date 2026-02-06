-- Add identification_number column to doctor_bank_accounts table
ALTER TABLE doctor_bank_accounts 
ADD COLUMN identification_number VARCHAR(13);
