-- AlterTable: Add missing columns to provider_branches
ALTER TABLE "provider_branches" 
ADD COLUMN IF NOT EXISTS "preview_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "ambulance_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "coverage_area" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "google_maps_url" VARCHAR(500);
