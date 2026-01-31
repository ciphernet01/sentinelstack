-- CreateEnum
CREATE TYPE "ComplianceType" AS ENUM ('SOC2_TYPE1', 'SOC2_TYPE2', 'ISO27001', 'ISO27017', 'ISO27018', 'GDPR', 'HIPAA', 'PCI_DSS', 'CCPA', 'FEDRAMP', 'NIST', 'CSA_STAR', 'CUSTOM');

-- CreateTable
CREATE TABLE "ComplianceBadge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ComplianceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationUrl" TEXT,
    "certificateUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "badgeImageUrl" TEXT,
    "displayOnPublicPage" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceBadge_organizationId_type_key" ON "ComplianceBadge"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ComplianceBadge_organizationId_displayOnPublicPage_idx" ON "ComplianceBadge"("organizationId", "displayOnPublicPage");

-- AddForeignKey
ALTER TABLE "ComplianceBadge" ADD CONSTRAINT "ComplianceBadge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
