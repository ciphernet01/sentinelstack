-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Organization" ADD COLUMN "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Organization" ADD COLUMN "subscriptionPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "scansUsedThisMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "scansResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_subscriptionId_key" ON "Organization"("subscriptionId");
