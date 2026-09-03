-- SentinelStack 26105: continuous cyber risk quantification foundation.

CREATE TYPE "BusinessCriticality" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "AssetEnvironment" AS ENUM ('INTERNET', 'CORPORATE', 'CLOUD', 'OT', 'THIRD_PARTY');
CREATE TYPE "ControlCategory" AS ENUM ('IAM', 'ENDPOINT', 'NETWORK', 'CLOUD', 'DATA_PROTECTION', 'MONITORING', 'RECOVERY', 'GOVERNANCE');
CREATE TYPE "TelemetrySource" AS ENUM ('VULNERABILITY_MANAGER', 'SIEM', 'IAM', 'EDR', 'CSPM', 'ASSET_INVENTORY', 'THREAT_INTEL');
CREATE TYPE "RiskScenarioType" AS ENUM ('MFA_PRIVILEGED_USERS', 'PATCH_CRITICAL_VULNERABILITIES', 'NETWORK_SEGMENTATION', 'EDR_ROLLOUT', 'CLOUD_HARDENING', 'CUSTOM');

CREATE TABLE "BusinessUnit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "owner" TEXT,
  "annualRevenueInr" BIGINT NOT NULL DEFAULT 0,
  "criticality" "BusinessCriticality" NOT NULL DEFAULT 'MODERATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CyberAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessUnitId" TEXT,
  "assetId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "ipAddress" TEXT,
  "serviceName" TEXT NOT NULL,
  "owner" TEXT,
  "environment" "AssetEnvironment" NOT NULL DEFAULT 'CORPORATE',
  "criticality" "BusinessCriticality" NOT NULL DEFAULT 'MODERATE',
  "internetExposed" BOOLEAN NOT NULL DEFAULT false,
  "revenueDependencyInr" BIGINT NOT NULL DEFAULT 0,
  "downtimeCostPerHourInr" BIGINT NOT NULL DEFAULT 0,
  "maxTolerableDowntimeHours" INTEGER NOT NULL DEFAULT 4,
  "dataSensitivity" INTEGER NOT NULL DEFAULT 3,
  "regulatoryExposureInr" BIGINT NOT NULL DEFAULT 0,
  "breachCostInr" BIGINT NOT NULL DEFAULT 0,
  "recoveryCostInr" BIGINT NOT NULL DEFAULT 0,
  "reputationCostInr" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CyberAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetDependency" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceAssetId" TEXT NOT NULL,
  "targetAssetId" TEXT NOT NULL,
  "dependencyType" TEXT NOT NULL,
  "criticality" "BusinessCriticality" NOT NULL DEFAULT 'MODERATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityControl" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "ControlCategory" NOT NULL,
  "description" TEXT,
  "baseCostInr" BIGINT NOT NULL DEFAULT 0,
  "iso27001" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "nistCsf" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "cisControls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rbiFramework" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sebiFramework" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetControl" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "coveragePercent" INTEGER NOT NULL DEFAULT 0,
  "effectivenessPercent" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PARTIAL',
  "lastObservedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CyberVulnerability" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "cve" TEXT,
  "title" TEXT NOT NULL,
  "cvss" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "epss" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "exploitAvailable" BOOLEAN NOT NULL DEFAULT false,
  "patchAvailable" BOOLEAN NOT NULL DEFAULT false,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "mappedControls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source" "TelemetrySource" NOT NULL DEFAULT 'VULNERABILITY_MANAGER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CyberVulnerability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityTelemetry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT,
  "source" "TelemetrySource" NOT NULL,
  "eventType" TEXT NOT NULL,
  "severity" "Severity" NOT NULL,
  "signalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityTelemetry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreatIntelIndicator" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "indicatorType" TEXT NOT NULL,
  "indicatorValue" TEXT NOT NULL,
  "cve" TEXT,
  "threatActor" TEXT,
  "campaign" TEXT,
  "sector" TEXT,
  "ttp" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreatIntelIndicator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'ENTERPRISE',
  "scopeRefId" TEXT,
  "totalFinancialExposureInr" BIGINT NOT NULL DEFAULT 0,
  "expectedAnnualLossInr" BIGINT NOT NULL DEFAULT 0,
  "valueAtRisk95Inr" BIGINT NOT NULL DEFAULT 0,
  "averageLikelihood" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "controlEffectiveness" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "topDrivers" JSONB NOT NULL,
  "assumptions" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskScenario" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "RiskScenarioType" NOT NULL DEFAULT 'CUSTOM',
  "budgetInr" BIGINT NOT NULL DEFAULT 0,
  "baselineEalInr" BIGINT NOT NULL DEFAULT 0,
  "simulatedEalInr" BIGINT NOT NULL DEFAULT 0,
  "riskReductionInr" BIGINT NOT NULL DEFAULT 0,
  "implementationCostInr" BIGINT NOT NULL DEFAULT 0,
  "rosi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "modeledChanges" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskScenario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessUnit_organizationId_name_key" ON "BusinessUnit"("organizationId", "name");
CREATE INDEX "BusinessUnit_organizationId_criticality_idx" ON "BusinessUnit"("organizationId", "criticality");

CREATE UNIQUE INDEX "CyberAsset_organizationId_assetId_key" ON "CyberAsset"("organizationId", "assetId");
CREATE INDEX "CyberAsset_organizationId_criticality_idx" ON "CyberAsset"("organizationId", "criticality");
CREATE INDEX "CyberAsset_organizationId_internetExposed_idx" ON "CyberAsset"("organizationId", "internetExposed");
CREATE INDEX "CyberAsset_businessUnitId_idx" ON "CyberAsset"("businessUnitId");

CREATE UNIQUE INDEX "AssetDependency_sourceAssetId_targetAssetId_dependencyType_key" ON "AssetDependency"("sourceAssetId", "targetAssetId", "dependencyType");
CREATE INDEX "AssetDependency_organizationId_idx" ON "AssetDependency"("organizationId");
CREATE INDEX "AssetDependency_targetAssetId_idx" ON "AssetDependency"("targetAssetId");

CREATE UNIQUE INDEX "SecurityControl_organizationId_controlId_key" ON "SecurityControl"("organizationId", "controlId");
CREATE INDEX "SecurityControl_organizationId_category_idx" ON "SecurityControl"("organizationId", "category");

CREATE UNIQUE INDEX "AssetControl_assetId_controlId_key" ON "AssetControl"("assetId", "controlId");
CREATE INDEX "AssetControl_organizationId_effectivenessPercent_idx" ON "AssetControl"("organizationId", "effectivenessPercent");
CREATE INDEX "AssetControl_controlId_idx" ON "AssetControl"("controlId");

CREATE INDEX "CyberVulnerability_organizationId_status_idx" ON "CyberVulnerability"("organizationId", "status");
CREATE INDEX "CyberVulnerability_assetId_cvss_idx" ON "CyberVulnerability"("assetId", "cvss");
CREATE INDEX "CyberVulnerability_cve_idx" ON "CyberVulnerability"("cve");

CREATE INDEX "SecurityTelemetry_organizationId_source_observedAt_idx" ON "SecurityTelemetry"("organizationId", "source", "observedAt");
CREATE INDEX "SecurityTelemetry_assetId_observedAt_idx" ON "SecurityTelemetry"("assetId", "observedAt");

CREATE INDEX "ThreatIntelIndicator_organizationId_active_idx" ON "ThreatIntelIndicator"("organizationId", "active");
CREATE INDEX "ThreatIntelIndicator_cve_idx" ON "ThreatIntelIndicator"("cve");

CREATE INDEX "RiskSnapshot_organizationId_computedAt_idx" ON "RiskSnapshot"("organizationId", "computedAt");
CREATE INDEX "RiskSnapshot_organizationId_scope_scopeRefId_idx" ON "RiskSnapshot"("organizationId", "scope", "scopeRefId");

CREATE INDEX "RiskScenario_organizationId_createdAt_idx" ON "RiskScenario"("organizationId", "createdAt");

ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CyberAsset" ADD CONSTRAINT "CyberAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CyberAsset" ADD CONSTRAINT "CyberAsset_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetDependency" ADD CONSTRAINT "AssetDependency_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "CyberAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetDependency" ADD CONSTRAINT "AssetDependency_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "CyberAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityControl" ADD CONSTRAINT "SecurityControl_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetControl" ADD CONSTRAINT "AssetControl_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CyberAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetControl" ADD CONSTRAINT "AssetControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "SecurityControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CyberVulnerability" ADD CONSTRAINT "CyberVulnerability_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CyberAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityTelemetry" ADD CONSTRAINT "SecurityTelemetry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CyberAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskScenario" ADD CONSTRAINT "RiskScenario_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
