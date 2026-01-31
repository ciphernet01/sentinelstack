-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('SCAN_COMPLETED', 'SCAN_FAILED', 'CRITICAL_FINDING', 'SCHEDULED_SCAN_RUN');

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "events" "WebhookEvent"[] DEFAULT ARRAY['SCAN_COMPLETED']::"WebhookEvent"[],
    "lastTriggeredAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" "WebhookEvent" NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "responseTime" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Webhook_organizationId_enabled_idx" ON "Webhook"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
