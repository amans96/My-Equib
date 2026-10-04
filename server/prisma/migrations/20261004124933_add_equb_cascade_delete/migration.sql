-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_equbId_fkey";

-- DropForeignKey
ALTER TABLE "BankTransaction" DROP CONSTRAINT "BankTransaction_equbId_fkey";

-- DropForeignKey
ALTER TABLE "EqubAdmin" DROP CONSTRAINT "EqubAdmin_equbId_fkey";

-- DropForeignKey
ALTER TABLE "EqubBankAccount" DROP CONSTRAINT "EqubBankAccount_equbId_fkey";

-- DropForeignKey
ALTER TABLE "EqubMembership" DROP CONSTRAINT "EqubMembership_equbId_fkey";

-- DropForeignKey
ALTER TABLE "LotteryDraw" DROP CONSTRAINT "LotteryDraw_equbId_fkey";

-- DropForeignKey
ALTER TABLE "LotteryDraw" DROP CONSTRAINT "LotteryDraw_periodId_fkey";

-- DropForeignKey
ALTER TABLE "LotteryEntry" DROP CONSTRAINT "LotteryEntry_lotteryId_fkey";

-- DropForeignKey
ALTER TABLE "LotteryEntry" DROP CONSTRAINT "LotteryEntry_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_equbId_fkey";

-- DropForeignKey
ALTER TABLE "OCRData" DROP CONSTRAINT "OCRData_receiptId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_periodId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentPeriod" DROP CONSTRAINT "PaymentPeriod_equbId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentVerification" DROP CONSTRAINT "PaymentVerification_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_lotteryId_fkey";

-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_paymentId_fkey";

-- AddForeignKey
ALTER TABLE "EqubMembership" ADD CONSTRAINT "EqubMembership_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubAdmin" ADD CONSTRAINT "EqubAdmin_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPeriod" ADD CONSTRAINT "PaymentPeriod_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "EqubMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PaymentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCRData" ADD CONSTRAINT "OCRData_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PaymentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "LotteryDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "EqubMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "LotteryDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubBankAccount" ADD CONSTRAINT "EqubBankAccount_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;
