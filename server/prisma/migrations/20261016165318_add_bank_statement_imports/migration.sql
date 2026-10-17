-- CreateEnum
CREATE TYPE "BankStatementImportStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "statementImportId" TEXT;

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "equbId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "source" "BankTransactionSource" NOT NULL DEFAULT 'BANK_STATEMENT',
    "status" "BankStatementImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatementImport_equbId_idx" ON "BankStatementImport"("equbId");

-- CreateIndex
CREATE INDEX "BankStatementImport_uploadedById_idx" ON "BankStatementImport"("uploadedById");

-- CreateIndex
CREATE INDEX "BankStatementImport_status_idx" ON "BankStatementImport"("status");

-- CreateIndex
CREATE INDEX "BankStatementImport_createdAt_idx" ON "BankStatementImport"("createdAt");

-- CreateIndex
CREATE INDEX "BankTransaction_statementImportId_idx" ON "BankTransaction"("statementImportId");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_statementImportId_fkey" FOREIGN KEY ("statementImportId") REFERENCES "BankStatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_equbId_fkey" FOREIGN KEY ("equbId") REFERENCES "Equb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
