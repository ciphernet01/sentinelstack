-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ScheduledScan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "toolPreset" TEXT NOT NULL DEFAULT 'default',
    "schedule" TEXT NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'WEEKLY',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledScan_organizationId_enabled_idx" ON "ScheduledScan"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "ScheduledScan_nextRunAt_enabled_idx" ON "ScheduledScan"("nextRunAt", "enabled");

-- AddForeignKey
ALTER TABLE "ScheduledScan" ADD CONSTRAINT "ScheduledScan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledScan" ADD CONSTRAINT "ScheduledScan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
