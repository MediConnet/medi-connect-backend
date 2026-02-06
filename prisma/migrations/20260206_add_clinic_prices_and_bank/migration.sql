-- Migration: Add consultation_prices and bank_account to clinics
-- Date: 2026-02-06
-- Description: Add JSON columns for consultation prices by specialty and bank account info

-- Add consultation_prices column (JSON array)
ALTER TABLE clinics 
ADD COLUMN consultation_prices JSON DEFAULT '[]'::json;

-- Add bank_account column (JSON object)
ALTER TABLE clinics 
ADD COLUMN bank_account JSON DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN clinics.consultation_prices IS 'Array of consultation prices by specialty: [{"specialty": "Cardiología", "price": 60.00, "isActive": true}]';
COMMENT ON COLUMN clinics.bank_account IS 'Bank account information: {"bankName": "...", "accountNumber": "...", "accountType": "checking|savings", "accountHolder": "...", "identificationNumber": "..."}';
