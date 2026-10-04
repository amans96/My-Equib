-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "EqubStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContributionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REMOVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EqubAdminRole" AS ENUM ('OWNER', 'MANAGER', 'TREASURER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "PaymentPeriodStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED', 'DRAW_PENDING', 'DRAW_COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_REVIEW', 'DUPLICATE', 'UNDERPAID', 'OVERPAID');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'DUPLICATE', 'SUSPICIOUS', 'REVERSED');

-- CreateEnum
CREATE TYPE "BankTransactionSource" AS ENUM ('MANUAL', 'CSV', 'EXCEL', 'API', 'BANK_STATEMENT');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('VERIFIED', 'REJECTED', 'NEEDS_REVIEW', 'DUPLICATE', 'UNDERPAID', 'OVERPAID');

-- CreateEnum
CREATE TYPE "LotteryStatus" AS ENUM ('PENDING', 'READY', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYMENT_REMINDER', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'LOTTERY_RESULT', 'PAYOUT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "profileImage" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equb" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contributionAmount" DECIMAL(12,2) NOT NULL,
    "frequency" "ContributionFrequency" NOT NULL,
    "totalPeriods" INTEGER NOT NULL,
    "currentPeriod" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "EqubStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EqubMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "equbId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberNumber" TEXT,
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "missedPayments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EqubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EqubAdmin" (
    "id" TEXT NOT NULL,
    "equbId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EqubAdminRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EqubAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPeriod" (
    "id" TEXT NOT NULL,
    "equbId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "status" "PaymentPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'UPLOADED',
    "ocrProcessed" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OCRData" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "transactionReference" TEXT,
    "senderName" TEXT,
    "senderAccount" TEXT,
    "receiverName" TEXT,
    "receiverAccount" TEXT,
    "amount" DECIMAL(12,2),
    "transactionDate" TIMESTAMP(3),
    "bankName" TEXT,
    "rawText" TEXT,
    "confidence" DECIMAL(5,2),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OCRData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "equbId" TEXT NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "senderName" TEXT,
    "senderAccount" TEXT,
    "receiverName" TEXT,
    "receiverAccount" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
    "source" "BankTransactionSource" NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedPaymentId" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVerification" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "reason" TEXT,
    "verifiedAmount" DECIMAL(12,2),
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryDraw" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "LotteryStatus" NOT NULL DEFAULT 'PENDING',
    "drawNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "winnerMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equbId" TEXT,

    CONSTRAINT "LotteryDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryEntry" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "ticketNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotteryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EqubBankAccount" (
    "id" TEXT NOT NULL,
    "equbId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "branchName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EqubBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "equbId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "equbId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Equb_status_idx" ON "Equb"("status");

-- CreateIndex
CREATE INDEX "Equb_createdById_idx" ON "Equb"("createdById");

-- CreateIndex
CREATE INDEX "EqubMembership_equbId_idx" ON "EqubMembership"("equbId");

-- CreateIndex
CREATE INDEX "EqubMembership_userId_idx" ON "EqubMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EqubMembership_userId_equbId_key" ON "EqubMembership"("userId", "equbId");

-- CreateIndex
CREATE INDEX "EqubAdmin_equbId_idx" ON "EqubAdmin"("equbId");

-- CreateIndex
CREATE INDEX "EqubAdmin_userId_idx" ON "EqubAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EqubAdmin_equbId_userId_key" ON "EqubAdmin"("equbId", "userId");

-- CreateIndex
CREATE INDEX "PaymentPeriod_equbId_idx" ON "PaymentPeriod"("equbId");

-- CreateIndex
CREATE INDEX "PaymentPeriod_status_idx" ON "PaymentPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPeriod_equbId_periodNumber_key" ON "PaymentPeriod"("equbId", "periodNumber");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_periodId_idx" ON "Payment"("periodId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_membershipId_periodId_key" ON "Payment"("membershipId", "periodId");

-- CreateIndex
CREATE INDEX "Receipt_paymentId_idx" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_uploadedById_idx" ON "Receipt"("uploadedById");

-- CreateIndex
CREATE INDEX "Receipt_status_idx" ON "Receipt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OCRData_receiptId_key" ON "OCRData"("receiptId");

-- CreateIndex
CREATE INDEX "OCRData_transactionReference_idx" ON "OCRData"("transactionReference");

-- CreateIndex
CREATE INDEX "BankTransaction_transactionDate_idx" ON "BankTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "BankTransaction_status_idx" ON "BankTransaction"("status");

-- CreateIndex
CREATE INDEX "BankTransaction_matchedPaymentId_idx" ON "BankTransaction"("matchedPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_equbId_transactionReference_key" ON "BankTransaction"("equbId", "transactionReference");

-- CreateIndex
CREATE INDEX "PaymentVerification_paymentId_idx" ON "PaymentVerification"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentVerification_reviewerId_idx" ON "PaymentVerification"("reviewerId");

-- CreateIndex
CREATE INDEX "PaymentVerification_decision_idx" ON "PaymentVerification"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryDraw_periodId_key" ON "LotteryDraw"("periodId");

-- CreateIndex
CREATE INDEX "LotteryDraw_status_idx" ON "LotteryDraw"("status");

-- CreateIndex
CREATE INDEX "LotteryDraw_winnerMembershipId_idx" ON "LotteryDraw"("winnerMembershipId");

-- CreateIndex
CREATE INDEX "LotteryEntry_userId_idx" ON "LotteryEntry"("userId");

-- CreateIndex
CREATE INDEX "LotteryEntry_eligible_idx" ON "LotteryEntry"("eligible");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryEntry_lotteryId_userId_key" ON "LotteryEntry"("lotteryId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryEntry_lotteryId_ticketNumber_key" ON "LotteryEntry"("lotteryId", "ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_lotteryId_key" ON "Payout"("lotteryId");

-- CreateIndex
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "EqubBankAccount_equbId_idx" ON "EqubBankAccount"("equbId");

-- CreateIndex
CREATE INDEX "EqubBankAccount_isActive_idx" ON "EqubBankAccount"("isActive");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_equbId_idx" ON "Notification"("equbId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_equbId_idx" ON "AuditLog"("equbId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Equb" ADD CONSTRAINT "Equb_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubMembership" ADD CONSTRAINT "EqubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubMembership" ADD CONSTRAINT "EqubMembership_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubAdmin" ADD CONSTRAINT "EqubAdmin_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubAdmin" ADD CONSTRAINT "EqubAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPeriod" ADD CONSTRAINT "PaymentPeriod_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "EqubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PaymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCRData" ADD CONSTRAINT "OCRData_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PaymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_winnerMembershipId_fkey" FOREIGN KEY ("winnerMembershipId") REFERENCES "EqubMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "LotteryDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "LotteryDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqubBankAccount" ADD CONSTRAINT "EqubBankAccount_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE SET NULL ON UPDATE CASCADE;
