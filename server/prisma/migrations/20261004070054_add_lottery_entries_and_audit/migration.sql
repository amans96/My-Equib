/*
  Warnings:

  - Added the required column `membershipId` to the `LotteryEntry` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LotteryEntryType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- DropIndex
DROP INDEX "LotteryEntry_lotteryId_userId_key";

-- AlterTable
ALTER TABLE "LotteryDraw" ADD COLUMN     "participantCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "totalEntries" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LotteryEntry" ADD COLUMN     "entryType" "LotteryEntryType" NOT NULL DEFAULT 'AUTOMATIC',
ADD COLUMN     "membershipId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "LotteryDraw_equbId_idx" ON "LotteryDraw"("equbId");

-- CreateIndex
CREATE INDEX "LotteryEntry_lotteryId_idx" ON "LotteryEntry"("lotteryId");

-- CreateIndex
CREATE INDEX "LotteryEntry_membershipId_idx" ON "LotteryEntry"("membershipId");

-- AddForeignKey
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "EqubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
