-- PS 26105 P1 — Risk Run Lineage & Assessment Foundation
-- Migration: 20260930000001_ps26105_risk_lineage_foundation
-- 
-- Adds three new models (additive only — no existing tables modified):
--   1. RiskRunStatus enum
--   2. RiskRun          — one record per calculation execution; tracks versions + hashes
--   3. RiskAssessment   — immutable, append-only result bound to a RiskRun
--   4. RiskAuditEvent   — append-only ledger for material risk operations
--
-- Existing models (RiskSnapshot, RiskScenario, etc.) are NOT modified.

-- 1. Enum
CREATE TYPE "RiskRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'STALE'
);

-- 2. RiskRun
CREATE TABLE "RiskRun" (
  "id"                      TEXT NOT NULL,
  "organizationId"          TEXT NOT NULL,
  "scopeType"               TEXT NOT NULL,
  "scopeId"                 TEXT NOT NULL,
  "asOf"                    TIMESTAMP(3) NOT NULL,
  "status"                  "RiskRunStatus" NOT NULL DEFAULT 'QUEUED',
  "riskEngineVersion"       TEXT NOT NULL DEFAULT 'deterministic-baseline-v0',
  "parameterVersion"        TEXT NOT NULL DEFAULT 'params-2026-09',
  "modelBundleVersion"      TEXT NOT NULL DEFAULT 'deterministic-baseline-v0',
  "featureSetVersion"       TEXT NOT NULL DEFAULT 'features-v1',
  "simulationConfigVersion" TEXT NOT NULL DEFAULT 'mc-config-v1',
  "inputStateHash"          TEXT NOT NULL,
  "resultHash"              TEXT,
  "coverageState"           JSONB,
  "errorCode"               TEXT,
  "errorMessage"            TEXT,
  "startedAt"               TIMESTAMP(3),
  "completedAt"             TIMESTAMP(3),
  "triggeredBy"             TEXT,
  "triggerReason"           TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RiskRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskRun_organizationId_status_idx"        ON "RiskRun"("organizationId", "status");
CREATE INDEX "RiskRun_organizationId_createdAt_idx"     ON "RiskRun"("organizationId", "createdAt");
CREATE INDEX "RiskRun_organizationId_scopeType_scopeId_idx"
  ON "RiskRun"("organizationId", "scopeType", "scopeId");

ALTER TABLE "RiskRun"
  ADD CONSTRAINT "RiskRun_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. RiskAssessment (immutable / append-only)
CREATE TABLE "RiskAssessment" (
  "id"                        TEXT NOT NULL,
  "riskRunId"                 TEXT NOT NULL,
  "organizationId"            TEXT NOT NULL,
  "scopeType"                 TEXT NOT NULL,
  "scopeId"                   TEXT NOT NULL,
  "computedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "asOf"                      TIMESTAMP(3) NOT NULL,
  "totalFinancialExposureInr" BIGINT NOT NULL DEFAULT 0,
  "expectedAnnualLossInr"     BIGINT NOT NULL DEFAULT 0,
  "valueAtRisk95Inr"          BIGINT NOT NULL DEFAULT 0,
  "averageLikelihood"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "controlEffectiveness"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskScore"                 INTEGER,
  "drivers"                   JSONB,
  "topDrivers"                JSONB,
  "assumptions"               JSONB,
  "riskEngineVersion"         TEXT NOT NULL,
  "parameterVersion"          TEXT NOT NULL,
  "modelBundleVersion"        TEXT NOT NULL,
  "inputStateHash"            TEXT NOT NULL,
  "resultHash"                TEXT,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskAssessment_organizationId_createdAt_idx"
  ON "RiskAssessment"("organizationId", "createdAt");
CREATE INDEX "RiskAssessment_riskRunId_idx"
  ON "RiskAssessment"("riskRunId");
CREATE INDEX "RiskAssessment_organization_scope_computed_idx"
  ON "RiskAssessment"("organizationId", "scopeType", "scopeId", "computedAt");

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_riskRunId_fkey"
  FOREIGN KEY ("riskRunId")
  REFERENCES "RiskRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. RiskAuditEvent (append-only ledger)
CREATE TABLE "RiskAuditEvent" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "riskRunId"      TEXT,
  "actor"          TEXT,
  "action"         TEXT NOT NULL,
  "inputStateHash" TEXT,
  "resultHash"     TEXT,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RiskAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskAuditEvent_organizationId_createdAt_idx"
  ON "RiskAuditEvent"("organizationId", "createdAt");
CREATE INDEX "RiskAuditEvent_riskRunId_idx"
  ON "RiskAuditEvent"("riskRunId");

ALTER TABLE "RiskAuditEvent"
  ADD CONSTRAINT "RiskAuditEvent_riskRunId_fkey"
  FOREIGN KEY ("riskRunId")
  REFERENCES "RiskRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
