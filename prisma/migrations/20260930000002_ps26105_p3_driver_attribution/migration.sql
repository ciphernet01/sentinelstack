-- PS 26105 P3 — Risk Driver Attribution & Evidence
-- Migration: 20260930000002_ps26105_p3_driver_attribution
--
-- Additive only — no existing table is altered or dropped:
--   1. Nine enums
--   2. RiskDriver        — normalized, evidence-linked risk driver
--   3. EvidenceRecord    — immutable source reference, deduplicated per source
--   4. RiskDriverEvidence— many-to-many driver <-> evidence
--
-- Existing RiskAssessment.drivers (JSON) is intentionally retained: P3 spec §13
-- requires backward compatibility, and the normalized rows become canonical
-- while the JSON column is regenerated from them for legacy consumers.

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "RiskDriverType" AS ENUM (
  'VULNERABILITY',
  'EXPOSURE',
  'THREAT',
  'CONTROL',
  'DEPENDENCY',
  'BUSINESS_IMPACT',
  'ASSET_CRITICALITY',
  'SERVICE_CRITICALITY',
  'TELEMETRY_SIGNAL',
  'MODEL_SIGNAL',
  'DATA_COVERAGE',
  'OTHER'
);

CREATE TYPE "RiskDriverAttributionMethod" AS ENUM (
  'MODEL',
  'COUNTERFACTUAL',
  'HIERARCHICAL',
  'EVIDENCE_RANKING'
);

CREATE TYPE "RiskDriverDirection" AS ENUM (
  'INCREASES_RISK',
  'REDUCES_RISK',
  'LIMITS_CONFIDENCE'
);

CREATE TYPE "RiskDriverConfidence" AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW',
  'INSUFFICIENT'
);

CREATE TYPE "RiskDriverReviewStatus" AS ENUM (
  'UNREVIEWED',
  'REVIEWED',
  'DISPUTED',
  'ACCEPTED',
  'REJECTED'
);

CREATE TYPE "EvidenceSourceType" AS ENUM (
  'VULNERABILITY',
  'SIEM',
  'IAM',
  'EDR',
  'CSPM',
  'ASSET_INVENTORY',
  'THREAT_INTEL',
  'BUSINESS_CONTEXT',
  'MODEL',
  'CALCULATION'
);

CREATE TYPE "EvidenceReliability" AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW'
);

CREATE TYPE "EvidenceQuality" AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNAVAILABLE'
);

CREATE TYPE "DriverEvidenceRelationship" AS ENUM (
  'PRIMARY_SUPPORT',
  'SECONDARY_SUPPORT',
  'CONTEXT',
  'MODEL_INPUT'
);

-- ─── RiskDriver ──────────────────────────────────────────────────────────────

CREATE TABLE "RiskDriver" (
  "id"                      TEXT NOT NULL,
  "organizationId"          TEXT NOT NULL,
  "riskAssessmentId"        TEXT NOT NULL,
  "riskRunId"               TEXT NOT NULL,
  "driverKey"               TEXT NOT NULL,
  "driverKeyVersion"        TEXT NOT NULL DEFAULT 'driver-key-v1',
  "type"                    "RiskDriverType" NOT NULL,
  "entityType"              TEXT NOT NULL,
  "entityId"                TEXT NOT NULL,
  "name"                    TEXT NOT NULL,
  "description"             TEXT,
  "attributionMethod"       "RiskDriverAttributionMethod" NOT NULL,
  "attributionVersion"      TEXT NOT NULL,
  -- Nullable per metric on purpose: NULL means "this attribution method does
  -- not support this metric", which is different from a measured zero.
  "contributionToEal"       DOUBLE PRECISION,
  "contributionToVar95"     DOUBLE PRECISION,
  "contributionToVar99"     DOUBLE PRECISION,
  "contributionToRiskScore" DOUBLE PRECISION,
  "direction"               "RiskDriverDirection" NOT NULL,
  "confidence"              "RiskDriverConfidence" NOT NULL,
  "rank"                    INTEGER NOT NULL DEFAULT 0,
  -- Human governance annotations. These never overwrite the model columns.
  "reviewStatus"            "RiskDriverReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "reviewedById"            TEXT,
  "reviewedAt"              TIMESTAMP(3),
  "reviewRationale"         TEXT,
  "attributionHash"         TEXT,
  "metadata"                JSONB,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RiskDriver_pkey" PRIMARY KEY ("id")
);

-- A driver is unique within one assessment, not globally: the same factor
-- legitimately appears in every run.
CREATE UNIQUE INDEX "RiskDriver_riskAssessmentId_driverKey_key"
  ON "RiskDriver"("riskAssessmentId", "driverKey");

CREATE INDEX "RiskDriver_organizationId_riskAssessmentId_idx"
  ON "RiskDriver"("organizationId", "riskAssessmentId");
CREATE INDEX "RiskDriver_organizationId_type_idx"
  ON "RiskDriver"("organizationId", "type");
CREATE INDEX "RiskDriver_riskRunId_idx"
  ON "RiskDriver"("riskRunId");
CREATE INDEX "RiskDriver_entityType_entityId_idx"
  ON "RiskDriver"("entityType", "entityId");
-- driverKey is the cross-run identity used for change comparison (spec §21.2).
CREATE INDEX "RiskDriver_organizationId_driverKey_idx"
  ON "RiskDriver"("organizationId", "driverKey");
CREATE INDEX "RiskDriver_organizationId_reviewStatus_idx"
  ON "RiskDriver"("organizationId", "reviewStatus");

-- ─── EvidenceRecord ──────────────────────────────────────────────────────────

CREATE TABLE "EvidenceRecord" (
  "id"                   TEXT NOT NULL,
  "organizationId"       TEXT NOT NULL,
  "sourceType"           "EvidenceSourceType" NOT NULL,
  "sourceRecordId"       TEXT NOT NULL,
  "canonicalEntityType"  TEXT,
  "canonicalEntityId"    TEXT,
  "observedAt"           TIMESTAMP(3),
  "collectedAt"          TIMESTAMP(3),
  "ingestedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceVersion"        TEXT,
  "evidenceHash"         TEXT,
  "reliability"          "EvidenceReliability" NOT NULL DEFAULT 'MEDIUM',
  "quality"              "EvidenceQuality" NOT NULL DEFAULT 'MEDIUM',
  "metadata"             JSONB,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- One row per source record, shared across every driver that cites it.
CREATE UNIQUE INDEX "EvidenceRecord_organizationId_sourceType_sourceRecordId_key"
  ON "EvidenceRecord"("organizationId", "sourceType", "sourceRecordId");

CREATE INDEX "EvidenceRecord_organizationId_sourceType_idx"
  ON "EvidenceRecord"("organizationId", "sourceType");
CREATE INDEX "EvidenceRecord_organizationId_quality_idx"
  ON "EvidenceRecord"("organizationId", "quality");
CREATE INDEX "EvidenceRecord_canonicalEntityType_canonicalEntityId_idx"
  ON "EvidenceRecord"("canonicalEntityType", "canonicalEntityId");

-- ─── RiskDriverEvidence ──────────────────────────────────────────────────────

CREATE TABLE "RiskDriverEvidence" (
  "riskDriverId"      TEXT NOT NULL,
  "evidenceRecordId"  TEXT NOT NULL,
  "relationshipType"  "DriverEvidenceRelationship" NOT NULL DEFAULT 'PRIMARY_SUPPORT',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RiskDriverEvidence_pkey" PRIMARY KEY ("riskDriverId", "evidenceRecordId")
);

CREATE INDEX "RiskDriverEvidence_evidenceRecordId_idx"
  ON "RiskDriverEvidence"("evidenceRecordId");

-- ─── Foreign keys ────────────────────────────────────────────────────────────
-- Cascades are intentional: deleting an assessment must not leave orphaned
-- drivers or evidence links pointing at a result that no longer exists.

ALTER TABLE "RiskDriver" ADD CONSTRAINT "RiskDriver_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskDriver" ADD CONSTRAINT "RiskDriver_riskAssessmentId_fkey"
  FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskDriver" ADD CONSTRAINT "RiskDriver_riskRunId_fkey"
  FOREIGN KEY ("riskRunId") REFERENCES "RiskRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskDriverEvidence" ADD CONSTRAINT "RiskDriverEvidence_riskDriverId_fkey"
  FOREIGN KEY ("riskDriverId") REFERENCES "RiskDriver"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskDriverEvidence" ADD CONSTRAINT "RiskDriverEvidence_evidenceRecordId_fkey"
  FOREIGN KEY ("evidenceRecordId") REFERENCES "EvidenceRecord"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
