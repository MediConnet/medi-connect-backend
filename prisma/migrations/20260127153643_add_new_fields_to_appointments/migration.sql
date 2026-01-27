-- CreateEnum
CREATE TYPE "enum_payment_method" AS ENUM ('CASH', 'CARD');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_method" "enum_payment_method" NOT NULL DEFAULT 'CASH';
