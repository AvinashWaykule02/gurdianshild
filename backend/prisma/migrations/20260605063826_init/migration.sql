/*
  Warnings:

  - You are about to drop the column `action` on the `SecurityLog` table. All the data in the column will be lost.
  - You are about to drop the column `deviceInfo` on the `SecurityLog` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `SecurityLog` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `SecurityLog` table. All the data in the column will be lost.
  - You are about to drop the column `transactionData` on the `SecurityLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `SecurityLog` table. All the data in the column will be lost.
  - You are about to drop the column `currentHash` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `previousHash` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Transaction` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sequenceNumber]` on the table `SecurityLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `auditData` to the `SecurityLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hmacSignature` to the `SecurityLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sequenceNumber` to the `SecurityLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SecurityLog" DROP CONSTRAINT "SecurityLog_userId_fkey";

-- DropIndex
DROP INDEX "SecurityLog_userId_id_idx";

-- DropIndex
DROP INDEX "Transaction_createdAt_idx";

-- DropIndex
DROP INDEX "Transaction_status_idx";

-- AlterTable
ALTER TABLE "SecurityLog" DROP COLUMN "action",
DROP COLUMN "deviceInfo",
DROP COLUMN "ipAddress",
DROP COLUMN "timestamp",
DROP COLUMN "transactionData",
DROP COLUMN "userId",
ADD COLUMN     "auditData" JSONB NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hmacSignature" TEXT NOT NULL,
ADD COLUMN     "sequenceNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "currentHash",
DROP COLUMN "isVerified",
DROP COLUMN "metadata",
DROP COLUMN "previousHash",
DROP COLUMN "status",
DROP COLUMN "type",
DROP COLUMN "updatedAt",
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "updatedAt";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "TransactionStatus";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateTable
CREATE TABLE "AuditOutbox" (
    "id" BIGSERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityChainState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "latestSequence" INTEGER NOT NULL DEFAULT 0,
    "latestHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityChainState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAnchor" (
    "id" SERIAL NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "anchorHash" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRun" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "checkedLogs" INTEGER NOT NULL DEFAULT 0,
    "failedLogs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditOutbox_status_idx" ON "AuditOutbox"("status");

-- CreateIndex
CREATE INDEX "AuditAnchor_sequenceNumber_idx" ON "AuditAnchor"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityLog_sequenceNumber_key" ON "SecurityLog"("sequenceNumber");

-- CreateIndex
CREATE INDEX "SecurityLog_sequenceNumber_idx" ON "SecurityLog"("sequenceNumber");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
