-- AlterTable
ALTER TABLE "provider_branches" ADD COLUMN IF NOT EXISTS "preview_images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
