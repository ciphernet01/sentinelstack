/*
  Warnings:

  - The values [STARTER,PROFESSIONAL] on the enum `SubscriptionTier` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionTier_new" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
ALTER TABLE "Organization" ALTER COLUMN "subscriptionTier" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "subscriptionTier" TYPE "SubscriptionTier_new" USING ("subscriptionTier"::text::"SubscriptionTier_new");
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
DROP TYPE "SubscriptionTier_old";
ALTER TABLE "Organization" ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';
COMMIT;

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "status" "ScanJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScanJob_assessmentId_key" ON "ScanJob"("assessmentId");

-- CreateIndex
CREATE INDEX "ScanJob_status_runAt_idx" ON "ScanJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "ScanJob_lockedAt_idx" ON "ScanJob"("lockedAt");

-- CreateIndex
CREATE INDEX "ScanJob_priority_runAt_idx" ON "ScanJob"("priority", "runAt");

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
