-- AlterTable
ALTER TABLE "provider_branches" ADD COLUMN     "consultation_fee" DECIMAL(10,2),
ADD COLUMN     "payment_methods" TEXT[],
ALTER COLUMN "is_active" SET DEFAULT false;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "years_of_experience" INTEGER DEFAULT 0;
