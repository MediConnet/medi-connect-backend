-- CreateEnum
CREATE TYPE "ad_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "enum_roles" ADD VALUE 'pharmacy';
ALTER TYPE "enum_roles" ADD VALUE 'lab';
ALTER TYPE "enum_roles" ADD VALUE 'ambulance';
ALTER TYPE "enum_roles" ADD VALUE 'supplies';

-- AlterTable
ALTER TABLE "provider_ads" ADD COLUMN     "status" "ad_status" NOT NULL DEFAULT 'PENDING';
