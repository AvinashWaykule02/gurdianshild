/*
  Warnings:

  - The values [user,admin,auditor,high_authority] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `SecurityChainState` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `SecurityChainState` table. All the data in the column will be lost.
  - You are about to drop the `AuditAnchor` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,sequenceNumber]` on the table `SecurityLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `SecurityChainState` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `SecurityLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `VerificationRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('ACTIVE', 'LOCKED', 'UNDER_REPAIR');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'AUDITOR', 'SENIOR_MANAGER', 'SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- DropIndex
DROP INDEX "SecurityLog_sequenceNumber_idx";

-- DropIndex
DROP INDEX "SecurityLog_sequenceNumber_key";

-- AlterTable
ALTER TABLE "Incident" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SecurityChainState" DROP CONSTRAINT "SecurityChainState_pkey",
DROP COLUMN "id",
ADD COLUMN     "userId" INTEGER NOT NULL,
ADD CONSTRAINT "SecurityChainState_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "SecurityLog" ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

-- AlterTable
ALTER TABLE "VerificationRun" ADD COLUMN     "userId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "AuditAnchor";

-- CreateTable
CREATE TABLE "ledger_state" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'ACTIVE',
    "locked_at" TIMESTAMP(3),
    "locked_reason" TEXT,
    "incident_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" SERIAL NOT NULL,
    "eventName" TEXT NOT NULL,
    "userId" INTEGER,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_state_user_id_key" ON "ledger_state"("user_id");

-- CreateIndex
CREATE INDEX "ledger_state_status_idx" ON "ledger_state"("status");

-- CreateIndex
CREATE INDEX "EventLog_eventName_idx" ON "EventLog"("eventName");

-- CreateIndex
CREATE INDEX "EventLog_userId_idx" ON "EventLog"("userId");

-- CreateIndex
CREATE INDEX "AuditOutbox_status_createdAt_idx" ON "AuditOutbox"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityLog_userId_sequenceNumber_key" ON "SecurityLog"("userId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "VerificationRun_userId_idx" ON "VerificationRun"("userId");

-- AddForeignKey
ALTER TABLE "SecurityChainState" ADD CONSTRAINT "SecurityChainState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityLog" ADD CONSTRAINT "SecurityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_verificationRunId_fkey" FOREIGN KEY ("verificationRunId") REFERENCES "VerificationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_state" ADD CONSTRAINT "ledger_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_state" ADD CONSTRAINT "ledger_state_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
