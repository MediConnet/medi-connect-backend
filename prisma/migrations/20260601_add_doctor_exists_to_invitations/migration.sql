-- Persist whether invitee already has a registered doctor account (auth/routing on accept).
ALTER TABLE "doctor_invitations" ADD COLUMN IF NOT EXISTS "doctor_exists" BOOLEAN;
