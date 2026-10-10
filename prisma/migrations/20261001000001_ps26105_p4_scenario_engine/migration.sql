-- PS 26105 P4 — Scenario Engine & What-If
-- Migration: 20261001000001_ps26105_p4_scenario_engine
--
-- Additive only. The existing RiskScenario table is deliberately left in place:
-- the spec requires historical scenario data to stay readable during migration
-- (P4 §94), so this adds the new structure alongside it rather than replacing.
--
--   1. Four enums
--   2. Scenario           a what-if definition, bound to a baseline assessment
--   3. ScenarioChange     one declared, typed change
--   4. ScenarioRun        one execution
--   5. ScenarioAssessment one immutable result, baseline and delta captured

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "ScenarioType" AS ENUM (
  'CONTROL',
  'VULNERABILITY_REMEDIATION',
  'EXPOSURE',
  'SEGMENTATION',
  'IDENTITY',
  'ENDPOINT',
  'CLOUD_HARDENING',
  'THREAT_RESPONSE',
  'BUSINESS_CONTINUITY',
  'ASSET_CHANGE',
  'DEPENDENCY',
  'INVESTMENT',
  'COMBINED',
  'CUSTOM'
);

CREATE TYPE "ScenarioStatus" AS ENUM (
  'DRAFT',
  'READY',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
  'ARCHIVED'
);

CREATE TYPE "ScenarioRunStatus" AS ENUM (
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE "ScenarioChangeTargetType" AS ENUM (
  'ASSET',
  'SERVICE',
  'VULNERABILITY',
  'CONTROL',
  'ASSET_CONTROL',
  'DEPENDENCY',
  'BUSINESS_UNIT',
  'THREAT_SIGNAL',
  'BUSINESS_PARAMETER'
);

CREATE TYPE "ScenarioChangeOperation" AS ENUM (
  'SET',
  'INCREASE',
  'DECREASE',
  'ENABLE',
  'DISABLE',
  'ADD',
  'REMOVE',
  'PATCH',
  'UNPATCH',
  'ISOLATE',
  'EXPOSE',
  'UNEXPOSE',
  'REASSIGN',
  'REPLACE'
);

-- ─── Scenario ───────────────────────────────────────────────────────────────

CREATE TABLE "Scenario" (
  "id"                        TEXT NOT NULL,
  "organizationId"            TEXT NOT NULL,
  "name"                      TEXT NOT NULL,
  "description"               TEXT,
  "type"                      "ScenarioType" NOT NULL DEFAULT 'CUSTOM',
  "status"                    "ScenarioStatus" NOT NULL DEFAULT 'DRAFT',
  "baselineRiskAssessmentId"  TEXT NOT NULL,
  "baselineRiskRunId"         TEXT NOT NULL,
  "baselineInputStateHash"    TEXT NOT NULL,
  "scenarioStateHash"         TEXT,
  "createdById"               TEXT,
  "archivedAt"                TIMESTAMP(3),
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Scenario_organizationId_createdAt_idx" ON "Scenario"("organizationId", "createdAt");
CREATE INDEX "Scenario_organizationId_status_idx" ON "Scenario"("organizationId", "status");
CREATE INDEX "Scenario_baselineRiskAssessmentId_idx" ON "Scenario"("baselineRiskAssessmentId");

-- ─── ScenarioChange ─────────────────────────────────────────────────────────
-- Unique on (scenarioId, sequence): application order is part of the identity,
-- so two changes cannot claim the same position (P4 §15).

CREATE TABLE "ScenarioChange" (
  "id"                  TEXT NOT NULL,
  "scenarioId"          TEXT NOT NULL,
  "targetType"          "ScenarioChangeTargetType" NOT NULL,
  "targetId"            TEXT NOT NULL,
  "fieldPath"           TEXT NOT NULL,
  "operation"           "ScenarioChangeOperation" NOT NULL,
  "newValue"            JSONB NOT NULL,
  "oldValue"            JSONB,
  "reason"              TEXT,
  "sourceDriverId"      TEXT,
  "investmentOptionId"  TEXT,
  "sequence"            INTEGER NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScenarioChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScenarioChange_scenarioId_sequence_key"
  ON "ScenarioChange"("scenarioId", "sequence");
CREATE INDEX "ScenarioChange_scenarioId_idx" ON "ScenarioChange"("scenarioId");

-- ─── ScenarioRun ─────────────────────────────────────────────────────────────

CREATE TABLE "ScenarioRun" (
  "id"                  TEXT NOT NULL,
  "scenarioId"          TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "status"              "ScenarioRunStatus" NOT NULL DEFAULT 'RUNNING',
  "scenarioStateHash"   TEXT NOT NULL,
  "engineResultHash"    TEXT,
  "errorMessage"        TEXT,
  "warnings"            JSONB,
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"         TIMESTAMP(3),

  CONSTRAINT "ScenarioRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScenarioRun_scenarioId_startedAt_idx" ON "ScenarioRun"("scenarioId", "startedAt");
CREATE INDEX "ScenarioRun_organizationId_status_idx" ON "ScenarioRun"("organizationId", "status");

-- ─── ScenarioAssessment ─────────────────────────────────────────────────────
-- Baseline figures are copied in rather than joined. A result must remain
-- readable after the baseline is superseded, and a delta must not silently
-- change because a later run replaced the numbers it was computed against.

CREATE TABLE "ScenarioAssessment" (
  "id"                        TEXT NOT NULL,
  "scenarioRunId"             TEXT NOT NULL,
  "organizationId"            TEXT NOT NULL,
  "riskAssessmentId"          TEXT,
  "eal"                       DOUBLE PRECISION NOT NULL,
  "var95"                     DOUBLE PRECISION NOT NULL,
  "var99"                     DOUBLE PRECISION NOT NULL,
  "financialExposure"         DOUBLE PRECISION NOT NULL,
  "riskScore"                 INTEGER NOT NULL,
  "currency"                  TEXT NOT NULL DEFAULT 'INR',
  "baselineEal"               DOUBLE PRECISION NOT NULL,
  "baselineVar95"             DOUBLE PRECISION NOT NULL,
  "baselineVar99"             DOUBLE PRECISION NOT NULL,
  "baselineFinancialExposure" DOUBLE PRECISION NOT NULL,
  "baselineRiskScore"         INTEGER NOT NULL,
  "deltaEal"                  DOUBLE PRECISION NOT NULL,
  "deltaVar95"                DOUBLE PRECISION NOT NULL,
  "deltaVar99"                DOUBLE PRECISION NOT NULL,
  "deltaFinancialExposure"    DOUBLE PRECISION NOT NULL,
  "deltaRiskScore"            INTEGER NOT NULL,
  "costInr"                   BIGINT,
  "avoidedEal"                DOUBLE PRECISION,
  "riskEngineVersion"         TEXT NOT NULL,
  "parameterVersion"          TEXT NOT NULL,
  "modelBundleVersion"        TEXT NOT NULL,
  "scenarioStateHash"         TEXT NOT NULL,
  "calculationHash"           TEXT,
  "drivers"                   JSONB,
  "metadata"                  JSONB,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScenarioAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScenarioAssessment_scenarioRunId_idx" ON "ScenarioAssessment"("scenarioRunId");
CREATE INDEX "ScenarioAssessment_organizationId_createdAt_idx"
  ON "ScenarioAssessment"("organizationId", "createdAt");

-- ─── Foreign keys ───────────────────────────────────────────────────────────
-- All cascade: deleting a scenario must not leave orphan runs or results
-- pointing at a definition that no longer exists.

ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScenarioChange" ADD CONSTRAINT "ScenarioChange_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScenarioRun" ADD CONSTRAINT "ScenarioRun_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScenarioAssessment" ADD CONSTRAINT "ScenarioAssessment_scenarioRunId_fkey"
  FOREIGN KEY ("scenarioRunId") REFERENCES "ScenarioRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
