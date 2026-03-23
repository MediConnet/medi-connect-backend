-- Add apple_id column to users table for Apple Sign In
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_id" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_apple_id_key" ON "users"("apple_id") WHERE "apple_id" IS NOT NULL;
