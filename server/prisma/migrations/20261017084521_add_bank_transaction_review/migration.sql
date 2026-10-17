-- CreateEnum
CREATE TYPE "BankTransactionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewStatus" "BankTransactionReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;
