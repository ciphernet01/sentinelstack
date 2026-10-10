/**
 * P3 — Driver Persistence
 *
 * Writes the normalized driver/evidence graph produced by
 * `riskAttribution.service.ts` to Postgres, and reads it back for the driver
 * API and drill-down.
 *
 * Tenancy is not optional: `organizationId` is part of every `where` clause and
 * every write validates that the assessment being written to actually belongs
 * to the caller's organisation. A driver id on its own never grants access
 * (P3 spec §26).
 */

import { prisma } from "../../config/db";
import type { Prisma } from "@prisma/client";
import { RiskDomainError } from "./errors";
import { hashRiskResult } from "../provenance/canonicalHash.service";
import type { AttributionResult, DriverRecord, PersistedEvidence } from "./riskAttribution.service";

export class RiskDriverNotFoundError extends RiskDomainError {
  constructor(message = "Risk driver not found") {
    super("RISK_DRIVER_NOT_FOUND", message, 404);
    this.name = "RiskDriverNotFoundError";
  }
}

export class EvidenceNotFoundError extends RiskDomainError {
  constructor(message = "Evidence record not found") {
    super("EVIDENCE_NOT_FOUND", message, 404);
    this.name = "EvidenceNotFoundError";
  }
}

/** The write targeted an assessment that this organisation does not own. */
export class AttributionScopeError extends RiskDomainError {
  constructor(message: string) {
    super("ATTRIBUTION_SCOPE_ERROR", message, 403);
    this.name = "AttributionScopeError";
  }
}

export interface PersistAttributionInput {
  organizationId: string;
  attribution: AttributionResult;
  actor?: string;
}

export interface PersistAttributionResult {
  driverCount: number;
  evidenceCount: number;
  linkCount: number;
  attributionSetHash: string;
}

/**
 * Canonical hash over the whole driver set.
 *
 * One fingerprint for an entire attribution, so a reviewer can compare two
 * runs without diffing individual rows (P3 spec §39/§40).
 */
export function hashAttributionSet(attribution: AttributionResult): string {
  return hashRiskResult({
    attributionVersion: attribution.attributionVersion,
    driverKeyVersion: attribution.driverKeyVersion,
    riskRunId: attribution.riskRunId,
    riskAssessmentId: attribution.riskAssessmentId,
    drivers: attribution.drivers
      .map((driver) => ({
        driverKey: driver.driverKey,
        type: driver.type,
        contributionToEal: driver.contributionToEal,
        contributionToRiskScore: driver.contributionToRiskScore,
        direction: driver.direction,
        confidence: driver.confidence,
        attributionHash: driver.attributionHash,
      }))
      .sort((a, b) => a.driverKey.localeCompare(b.driverKey)),
    evidence: attribution.evidence
      .map((item) => `${item.sourceType}:${item.sourceRecordId}:${item.evidenceHash}`)
      .sort(),
  });
}

/**
 * Persist an attribution set: evidence first, then drivers, then the links.
 *
 * Ordering matters — drivers and links both reference evidence rows, so
 * evidence must exist before the links that point at it. The whole thing runs
 * in one transaction: a partially written attribution set is worse than none,
 * because it would look complete to a reader.
 */
export async function persistAttribution(
  input: PersistAttributionInput
): Promise<PersistAttributionResult> {
  const { organizationId, attribution } = input;
  const { riskRunId, riskAssessmentId } = attribution;

  // Guard the write: the assessment must exist AND belong to this organisation.
  const assessment = await prisma.riskAssessment.findFirst({
    where: { id: riskAssessmentId, organizationId },
    select: { id: true, riskRunId: true },
  });

  if (!assessment) {
    throw new AttributionScopeError(
      `RiskAssessment ${riskAssessmentId} does not exist in organization ${organizationId}`
    );
  }

  if (assessment.riskRunId !== riskRunId) {
    throw new AttributionScopeError(
      `RiskRun ${riskRunId} does not own RiskAssessment ${riskAssessmentId}`
    );
  }

  const attributionSetHash = hashAttributionSet(attribution);

  return prisma.$transaction(async (tx) => {
    // ── Evidence: upsert on the natural key so shared records are reused ──
    const evidenceIdByKey = new Map<string, string>();

    for (const item of attribution.evidence) {
      const record = await tx.evidenceRecord.upsert({
        where: {
          organizationId_sourceType_sourceRecordId: {
            organizationId,
            sourceType: item.sourceType,
            sourceRecordId: item.sourceRecordId,
          },
        },
        create: {
          organizationId,
          sourceType: item.sourceType,
          sourceRecordId: item.sourceRecordId,
          canonicalEntityType: item.canonicalEntityType,
          canonicalEntityId: item.canonicalEntityId,
          observedAt: item.observedAt,
          sourceVersion: item.sourceVersion,
          evidenceHash: item.evidenceHash,
          reliability: item.reliability,
          quality: item.quality,
          metadata: (item.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          // Refresh observability, never identity. A re-observed record keeps
          // its id so historical links stay valid.
          observedAt: item.observedAt,
          sourceVersion: item.sourceVersion,
          evidenceHash: item.evidenceHash,
          quality: item.quality,
        },
        select: { id: true },
      });

      evidenceIdByKey.set(`${item.sourceType}:${item.sourceRecordId}`, record.id);
    }

    // ── Drivers ────────────────────────────────────────────────────────────
    const driverIdByKey = new Map<string, string>();

    for (const record of attribution.drivers) {
      const created = await tx.riskDriver.create({
        data: {
          organizationId,
          riskAssessmentId,
          riskRunId,
          driverKey: record.driverKey,
          driverKeyVersion: record.driverKeyVersion,
          type: record.type,
          entityType: record.entityType,
          entityId: record.entityId,
          name: record.name,
          description: record.description ?? null,
          attributionMethod: record.attributionMethod,
          attributionVersion: record.attributionVersion,
          contributionToEal: record.contributionToEal,
          contributionToVar95: record.contributionToVar95,
          contributionToVar99: record.contributionToVar99,
          contributionToRiskScore: record.contributionToRiskScore,
          direction: record.direction,
          confidence: record.confidence,
          rank: record.rank,
          attributionHash: record.attributionHash,
          metadata: record.metadata as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      driverIdByKey.set(record.driverKey, created.id);
    }

    // ── Driver <-> evidence links ──────────────────────────────────────────
    let linkCount = 0;

    for (const record of attribution.drivers) {
      const driverId = driverIdByKey.get(record.driverKey);
      if (!driverId) continue;

      for (const item of record.evidence) {
        const evidenceId = evidenceIdByKey.get(`${item.sourceType}:${item.sourceRecordId}`);
        if (!evidenceId) continue;

        // createMany with skipDuplicates: the composite primary key makes a
        // re-linked pair a no-op rather than an error.
        const inserted = await tx.riskDriverEvidence.createMany({
          data: [
            {
              riskDriverId: driverId,
              evidenceRecordId: evidenceId,
              relationshipType: relationshipFor(record),
            },
          ],
          skipDuplicates: true,
        });
        linkCount += inserted.count;
      }
    }

    // ── Audit (P3 spec §27) ────────────────────────────────────────────────
    await tx.riskAuditEvent.create({
      data: {
        organizationId,
        riskRunId,
        actor: input.actor ?? "system",
        action: "ATTRIBUTION_PERSISTED",
        resultHash: attributionSetHash,
        metadata: {
          riskAssessmentId,
          attributionVersion: attribution.attributionVersion,
          driverCount: attribution.drivers.length,
          evidenceCount: attribution.evidence.length,
          linkCount,
          warnings: attribution.warnings,
        },
      },
    });

    return {
      driverCount: attribution.drivers.length,
      evidenceCount: attribution.evidence.length,
      linkCount,
      attributionSetHash,
    };
  });
}

/**
 * Relationship of a driver's evidence to that driver.
 *
 * A model signal is the *input* the engine consumed; everything else is
 * corroborating support for a measured counterfactual.
 */
function relationshipFor(record: DriverRecord): "PRIMARY_SUPPORT" | "MODEL_INPUT" {
  return record.type === "MODEL_SIGNAL" ? "MODEL_INPUT" : "PRIMARY_SUPPORT";
}

// ---------------------------------------------------------------------------
// Queries (P3 spec §24.1, §24.2, §26)
// ---------------------------------------------------------------------------

export interface ListDriversFilters {
  organizationId: string;
  riskAssessmentId?: string;
  riskRunId?: string;
  type?: DriverRecord["type"] | DriverRecord["type"][];
  direction?: "INCREASES_RISK" | "REDUCES_RISK" | "LIMITS_CONFIDENCE";
  reviewStatus?: "UNREVIEWED" | "REVIEWED" | "DISPUTED" | "ACCEPTED" | "REJECTED";
  minContributionToEal?: number;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

/**
 * List drivers for an organisation.
 *
 * `organizationId` is mandatory and always applied — there is no code path that
 * lists drivers across tenants, even with a valid driver id.
 */
export async function listRiskDrivers(filters: ListDriversFilters) {
  const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  return prisma.riskDriver.findMany({
    where: {
      // Tenant boundary. Not optional.
      organizationId: filters.organizationId,
      ...(filters.riskAssessmentId ? { riskAssessmentId: filters.riskAssessmentId } : {}),
      ...(filters.riskRunId ? { riskRunId: filters.riskRunId } : {}),
      ...(filters.type
        ? { type: Array.isArray(filters.type) ? { in: filters.type } : filters.type }
        : {}),
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.minContributionToEal !== undefined
        ? { contributionToEal: { gte: filters.minContributionToEal } }
        : {}),
    },
    include: { evidenceLinks: { select: { evidenceRecordId: true } } },
    orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
    take,
  });
}

/** Fetch one driver with its evidence and calculation lineage. */
export async function getRiskDriver(organizationId: string, driverId: string) {
  const driver = await prisma.riskDriver.findFirst({
    where: { id: driverId, organizationId },
    include: {
      evidenceLinks: {
        include: { evidenceRecord: true },
        orderBy: { createdAt: "asc" },
      },
      riskAssessment: {
        select: {
          id: true,
          scopeType: true,
          scopeId: true,
          asOf: true,
          expectedAnnualLossInr: true,
          valueAtRisk95Inr: true,
          totalFinancialExposureInr: true,
          riskScore: true,
          riskEngineVersion: true,
          parameterVersion: true,
          modelBundleVersion: true,
          inputStateHash: true,
          resultHash: true,
        },
      },
      riskRun: {
        select: {
          id: true,
          status: true,
          asOf: true,
          riskEngineVersion: true,
          parameterVersion: true,
          modelBundleVersion: true,
          featureSetVersion: true,
          simulationConfigVersion: true,
          inputStateHash: true,
          resultHash: true,
        },
      },
    },
  });

  if (!driver) throw new RiskDriverNotFoundError();
  return driver;
}

/** Fetch one evidence record, tenant-scoped. */
export async function getEvidenceRecord(organizationId: string, evidenceId: string) {
  const record = await prisma.evidenceRecord.findFirst({
    where: { id: evidenceId, organizationId },
    include: {
      driverLinks: {
        select: {
          riskDriverId: true,
          relationshipType: true,
          riskDriver: { select: { id: true, name: true, type: true, rank: true } },
        },
      },
    },
  });

  if (!record) throw new EvidenceNotFoundError();
  return record;
}

/** Evidence for a driver, with freshness recomputed against the run's asOf. */
export async function listDriverEvidence(
  organizationId: string,
  driverId: string,
  asOf: Date
) {
  const driver = await prisma.riskDriver.findFirst({
    where: { id: driverId, organizationId },
    select: { id: true },
  });
  if (!driver) throw new RiskDriverNotFoundError();

  const links = await prisma.riskDriverEvidence.findMany({
    where: { riskDriverId: driverId, evidenceRecord: { organizationId } },
    include: { evidenceRecord: true },
    orderBy: { createdAt: "asc" },
  });

  return links.map((link) => {
    const record = link.evidenceRecord;
    // Age is computed against the run's asOf, not now, so a historical driver
    // keeps the freshness it had at calculation time.
    const ageDays = record.observedAt
      ? Math.max(0, (asOf.getTime() - record.observedAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      ...record,
      relationshipType: link.relationshipType,
      ageDays,
    };
  });
}

/**
 * Record a human governance annotation.
 *
 * The model output (contributions, direction, confidence, attributionHash) is
 * never touched — only the review columns move. That distinction is the whole
 * point of the governance layer (P3 spec §27.1).
 */
export async function annotateDriverReview(input: {
  organizationId: string;
  driverId: string;
  reviewStatus: "UNREVIEWED" | "REVIEWED" | "DISPUTED" | "ACCEPTED" | "REJECTED";
  actor: string;
  rationale?: string;
}) {
  const existing = await prisma.riskDriver.findFirst({
    where: { id: input.driverId, organizationId: input.organizationId },
    select: { id: true, attributionHash: true },
  });
  if (!existing) throw new RiskDriverNotFoundError();

  const updated = await prisma.riskDriver.update({
    where: { id: input.driverId },
    data: {
      reviewStatus: input.reviewStatus,
      reviewedById: input.actor,
      reviewedAt: new Date(),
      reviewRationale: input.rationale ?? null,
    },
    select: {
      id: true,
      reviewStatus: true,
      reviewedById: true,
      reviewedAt: true,
      reviewRationale: true,
      attributionHash: true,
    },
  });

  await prisma.riskAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      actor: input.actor,
      action: "DRIVER_REVIEW_ANNOTATED",
      resultHash: existing.attributionHash,
      metadata: {
        driverId: input.driverId,
        reviewStatus: input.reviewStatus,
        rationale: input.rationale ?? null,
      },
    },
  });

  return updated;
}
