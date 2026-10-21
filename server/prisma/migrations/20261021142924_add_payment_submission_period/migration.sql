-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "submittedForPeriodId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_submittedForPeriodId_idx" ON "Payment"("submittedForPeriodId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_submittedForPeriodId_fkey" FOREIGN KEY ("submittedForPeriodId") REFERENCES "PaymentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
