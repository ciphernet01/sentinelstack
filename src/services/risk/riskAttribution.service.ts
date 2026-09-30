/**
 * P3 — Risk Driver Attribution (persistence-facing)
 *
 * P2's `driverAttribution.service.ts` computes the *numbers*: for each factor,
 * the measured change in enterprise expected loss when that factor is
 * neutralized. Those drivers are correct but transient — they exist only in the
 * result payload.
 *
 * This module turns them into the normalized, evidence-linked, queryable
 * records P3 requires (spec §8, §13, §16):
 *
 *   P2 result + risk context
 *          |
 *          +--> stable driver key      (cross-run identity, spec §21.2)
 *          +--> evidence resolution    (typed, freshness-scored)
 *          +--> confidence capping     (evidence can only lower confidence)
 *          +--> ranking
 *          +--> attribution hash       (spec §39)
 *          |
 *          v
 *   RiskDriverRecord + EvidenceRecord[]  → persisted by driverStore.service.ts
 *
 * It does NOT recalculate risk. EAL / VaR / score come from P2 unchanged
 * (spec §5.2); P3 only explains them.
 */

import { hashRiskResult } from "../provenance/canonicalHash.service";
import type {
  RiskAssetContext,
  RiskCalculationContext,
  RiskCalculationResult,
  RiskDependencyContext,
  RiskDriver,
  RiskDriverConfidence,
} from "./riskCalculationContext";
import type { RiskParameterBundle } from "./assumptions.service";
import {
  ATTRIBUTION_VERSION,
  DRIVER_KEY_VERSION,
  capConfidenceByEvidence,
  dedupeEvidence,
  evidenceForAsset,
  evidenceForBusinessImpact,
  evidenceForCalculation,
  evidenceForTelemetry,
  evidenceForVulnerability,
  resolveEvidence,
  summariseEvidenceQuality,
  type DriverEvidenceRelationshipType,
  type EvidenceDraft,
  type EvidenceSourceTypeName,
  type ResolvedEvidence,
} from "./evidence.service";

export const DRIVER_ATTRIBUTION_P3_VERSION = ATTRIBUTION_VERSION;
export const DRIVER_ATTRIBUTION_MODEL = "COUNTERFACTUAL";

/**
 * Cost controls (P3 spec §36). Attribution must never silently drop work: if
 * the budget is exceeded the result carries an explicit partial-attribution
 * warning and the unprocessed candidate count.
 */
export interface AttributionCostControls {
  maxDriverCandidates: number;
  maxCounterfactualRuns: number;
  topDriverCount: number;
  timeoutSeconds: number;
}

export const DEFAULT_ATTRIBUTION_COSTS: AttributionCostControls = Object.freeze({
  maxDriverCandidates: 500,
  maxCounterfactualRuns: 50,
  topDriverCount: 10,
  timeoutSeconds: 30,
});

export type P3Direction = "INCREASES_RISK" | "REDUCES_RISK" | "LIMITS_CONFIDENCE";
/** Reuses the shared confidence vocabulary so P2 and P3 cannot drift apart. */
export type P3Confidence = RiskDriverConfidence;

export interface DriverRecord {
  /** Cross-run stable identity. Unique per (assessment, driverKey). */
  driverKey: string;
  driverKeyVersion: string;
  type: RiskDriver["type"];
  entityType: string;
  entityId: string;
  name: string;
  description?: string;
  attributionMethod: "COUNTERFACTUAL" | "MODEL" | "HIERARCHICAL" | "EVIDENCE_RANKING";
  attributionVersion: string;
  /** Per-metric. Null means "this method does not support this metric". */
  contributionToEal: number | null;
  contributionToVar95: number | null;
  contributionToVar99: number | null;
  contributionToRiskScore: number | null;
  direction: P3Direction;
  confidence: P3Confidence;
  rank: number;
  attributionHash: string;
  evidence: ResolvedEvidence[];
  metadata: Record<string, unknown>;
}

export interface PersistedEvidence {
  sourceType: EvidenceSourceTypeName;
  sourceRecordId: string;
  canonicalEntityType: string;
  canonicalEntityId: string;
  observedAt: Date | null;
  sourceVersion: string | null;
  reliability: "HIGH" | "MEDIUM" | "LOW";
  quality: "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
  evidenceHash: string;
  relationshipType: DriverEvidenceRelationshipType;
  metadata?: Record<string, unknown>;
}

export interface AttributionResult {
  riskRunId: string;
  riskAssessmentId: string;
  organizationId: string;
  attributionVersion: string;
  driverKeyVersion: string;
  drivers: DriverRecord[];
  /** Flat, deduplicated evidence set across all drivers in this result. */
  evidence: PersistedEvidence[];
  evidenceQuality: ReturnType<typeof summariseEvidenceQuality>;
  warnings: string[];
  costReport: {
    candidates: number;
    attributed: number;
    counterfactualRuns: number;
    droppedByBudget: number;
    durationMs: number;
    exceededBudget: boolean;
  };
}

/**
 * Build the P2 `driverKey` for a driver.
 *
 * The key must be stable across runs so the same underlying factor compares
 * across assessments (spec §21.2). It is derived from type + entity scope, not
 * from the driver id or its rank, both of which vary run to run.
 */
export function buildDriverKey(
  type: RiskDriver["type"],
  entityType: string,
  entityId: string
): string {
  return [type, entityType, entityId].join(":");
}

/** Infer the scope level a driver refers to, from its entity reference. */
export function inferEntityType(driver: RiskDriver): { entityType: string; entityId: string } {
  if (driver.entityRef === "enterprise") {
    return { entityType: "ORGANIZATION", entityId: driver.entityRef };
  }
  if (driver.type === "CONTROL") {
    return { entityType: "CONTROL_CATEGORY", entityId: driver.entityRef };
  }
  if (driver.type === "MODEL_SIGNAL") {
    return { entityType: "TELEMETRY_SOURCE", entityId: driver.entityRef };
  }
  if (driver.type === "DEPENDENCY") {
    return { entityType: "DEPENDENCY", entityId: driver.entityRef };
  }
  return { entityType: "ASSET", entityId: driver.entityRef };
}

/**
 * Collect the evidence that supports one P2 driver.
 *
 * Mapping is by driver type, and each mapping is explicit. A driver whose
 * evidence cannot be identified returns an empty set, which downgrades
 * confidence to INSUFFICIENT rather than inventing a citation.
 */
export function collectEvidenceForDriver(
  driver: RiskDriver,
  context: RiskCalculationContext,
  result: RiskCalculationResult
): EvidenceDraft[] {
  const assetsById = new Map(context.assets.map((asset) => [asset.assetId, asset]));
  const drafts: EvidenceDraft[] = [];

  // Every driver is explained by the calculation that produced it.
  drafts.push(
    evidenceForCalculation(
      result.inputStateHash,
      result.resultHash,
      result.versions.riskEngine
    )
  );

  if (driver.type === "VULNERABILITY") {
    for (const asset of context.assets) {
      for (const vulnerability of asset.vulnerabilities) {
        if (driver.evidenceRefs.includes(vulnerability.id)) {
          drafts.push(...evidenceForVulnerability(asset, vulnerability, context.asOf));
        }
      }
    }
  }

  if (driver.type === "EXPOSURE" || driver.type === "ASSET_CRITICALITY") {
    for (const ref of driver.evidenceRefs) {
      const asset = assetsById.get(ref);
      if (asset) drafts.push(evidenceForAsset(asset));
    }
  }

  if (driver.type === "MODEL_SIGNAL") {
    for (const asset of context.assets) {
      for (const event of asset.telemetry) {
        if (driver.evidenceRefs.includes(event.id)) {
          drafts.push(evidenceForTelemetry(asset, event));
        }
      }
    }
  }

  if (driver.type === "CONTROL") {
    for (const ref of driver.evidenceRefs) {
      for (const asset of context.assets) {
        const control = asset.controls.find((candidate) => candidate.controlId === ref);
        if (control) {
          drafts.push({
            sourceType: "IAM",
            sourceRecordId: control.controlId,
            canonicalEntityType: "ASSET",
            canonicalEntityId: asset.assetId,
            reliability: "HIGH",
            metadata: {
              controlId: control.controlId,
              category: control.category,
              coverage: control.coverage,
              effectiveness: control.effectiveness,
              status: control.status,
            },
          });
        }
      }
    }
  }

  if (driver.type === "BUSINESS_IMPACT") {
    const asset = assetsById.get(driver.entityRef);
    if (asset) drafts.push(evidenceForBusinessImpact(asset));
  }

  if (driver.type === "DEPENDENCY") {
    for (const dependency of context.dependencies) {
      if (driver.evidenceRefs.includes(`${dependency.sourceAssetId}->${dependency.targetAssetId}`)) {
        drafts.push({
          sourceType: "ASSET_INVENTORY",
          sourceRecordId: `${dependency.sourceAssetId}->${dependency.targetAssetId}`,
          canonicalEntityType: "DEPENDENCY",
          canonicalEntityId: `${dependency.sourceAssetId}->${dependency.targetAssetId}`,
          reliability: "HIGH",
          metadata: { ...dependency },
        });
      }
    }
  }

  return drafts;
}

export interface RiskAttributionInput {
  organizationId: string;
  riskRunId: string;
  riskAssessmentId: string;
  context: RiskCalculationContext;
  result: RiskCalculationResult;
  costs?: Partial<AttributionCostControls>;
}

/**
 * Produce the normalized, evidence-linked driver set for one assessment.
 *
 * Deterministic: the same P2 result and context always produce the same driver
 * keys, ranks and hashes. Nothing here recalculates financial risk.
 */
export function attributeDriversForAssessment(
  input: RiskAttributionInput
): AttributionResult {
  const startedAt = Date.now();
  const costs: AttributionCostControls = {
    ...DEFAULT_ATTRIBUTION_COSTS,
    ...(input.costs ?? {}),
  };
  const warnings: string[] = [];
  const { context, result, riskRunId, riskAssessmentId, organizationId } = input;

  // ── Stage 1: candidate generation ─────────────────────────────────────────
  const candidates = result.drivers;

  if (candidates.length > costs.maxDriverCandidates) {
    warnings.push(
      `Driver candidates (${candidates.length}) exceeded the configured budget ` +
        `(${costs.maxDriverCandidates}); the tail was not attributed.`
    );
  }

  const budgeted = candidates.slice(0, costs.maxDriverCandidates);
  const counterfactualRuns = budgeted.length;
  const droppedByBudget = candidates.length - budgeted.length;

  if (counterfactualRuns > costs.maxCounterfactualRuns) {
    warnings.push(
      `Counterfactual runs (${counterfactualRuns}) exceeded the configured budget ` +
        `(${costs.maxCounterfactualRuns}); attribution is partial.`
    );
  }

  // ── Stage 2/3: evidence resolution + contribution normalisation ───────────
  const evidenceSeen = new Map<string, PersistedEvidence>();
  const records: DriverRecord[] = [];
  const usedKeys = new Set<string>();

  for (const candidate of budgeted) {
    const { entityType, entityId } = inferEntityType(candidate);
    const driverKey = buildDriverKey(candidate.type, entityType, entityId);

    // Collapse duplicate keys for the same entity: the first (highest ranked)
    // representation wins, so ranking stays meaningful.
    if (usedKeys.has(driverKey)) continue;
    usedKeys.add(driverKey);

    const resolved = dedupeEvidence(
      collectEvidenceForDriver(candidate, context, result)
    ).map((draft) => resolveEvidence(draft, context.asOf));

    const relationshipType: DriverEvidenceRelationshipType =
      candidate.type === "MODEL_SIGNAL" ? "MODEL_INPUT" : "PRIMARY_SUPPORT";

    for (const item of resolved) {
      const key = `${item.sourceType}:${item.sourceRecordId}`;
      if (evidenceSeen.has(key)) continue;
      evidenceSeen.set(key, {
        sourceType: item.sourceType,
        sourceRecordId: item.sourceRecordId,
        canonicalEntityType: item.canonicalEntityType,
        canonicalEntityId: item.canonicalEntityId,
        observedAt: item.observedAt ?? null,
        sourceVersion: item.sourceVersion ?? null,
        reliability: item.reliability,
        quality: item.quality,
        evidenceHash: item.evidenceHash,
        relationshipType,
        metadata: item.metadata,
      });
    }

    const confidence = capConfidenceByEvidence(candidate.confidence, resolved);

    if (confidence === "INSUFFICIENT" && candidate.confidence !== "INSUFFICIENT") {
      warnings.push(
        `Driver "${candidate.name}" had no usable supporting evidence; confidence reduced to INSUFFICIENT.`
      );
    }

    // ── Stage 4: contribution + self-hash ──────────────────────────────────
    const attributionHash = hashRiskResult({
      driverKey,
      driverKeyVersion: DRIVER_KEY_VERSION,
      attributionMethod: DRIVER_ATTRIBUTION_MODEL,
      attributionVersion: DRIVER_ATTRIBUTION_P3_VERSION,
      contributionToEal: candidate.contributionToEal ?? null,
      contributionToRiskScore: candidate.contributionToScore ?? null,
      direction: candidate.direction,
      confidence,
      evidence: resolved.map((item) => item.evidenceHash).sort(),
      riskAssessmentId,
      modelBundle: result.versions.modelBundle,
      parameterVersion: result.versions.parameters,
    });

    records.push({
      driverKey,
      driverKeyVersion: DRIVER_KEY_VERSION,
      type: candidate.type,
      entityType,
      entityId,
      name: candidate.name,
      attributionMethod: DRIVER_ATTRIBUTION_MODEL,
      attributionVersion: DRIVER_ATTRIBUTION_P3_VERSION,
      contributionToEal: candidate.contributionToEal ?? null,
      // P2 does not attribute the tail per driver (documented in the P2 record).
      // Null is the honest value here: "not computed", not "zero".
      contributionToVar95: null,
      contributionToVar99: null,
      contributionToRiskScore: candidate.contributionToScore ?? null,
      direction: candidate.direction,
      confidence,
      rank: 0,
      attributionHash,
      evidence: resolved,
      metadata: {
        sourceConfidence: candidate.confidence,
        evidenceRefs: candidate.evidenceRefs,
        isStaleEvidence: resolved.some((item) => item.isStale),
      },
    });
  }

  // ── Stage 5: rank risk-increasing drivers first, mitigations last ────────
  records.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "INCREASES_RISK" ? -1 : 1;
    return (b.contributionToEal ?? 0) - (a.contributionToEal ?? 0);
  });
  records.forEach((record, index) => {
    record.rank = index + 1;
  });

  const evidence = Array.from(evidenceSeen.values());
  const allResolved = records.flatMap((record) => record.evidence);
  const durationMs = Date.now() - startedAt;
  const exceededBudget = droppedByBudget > 0;

  if (durationMs > costs.timeoutSeconds * 1000) {
    warnings.push(
      `Attribution took ${durationMs}ms, exceeding the ${costs.timeoutSeconds}s budget; ` +
        `the result is partial.`
    );
  }

  return {
    riskRunId,
    riskAssessmentId,
    organizationId,
    attributionVersion: DRIVER_ATTRIBUTION_P3_VERSION,
    driverKeyVersion: DRIVER_KEY_VERSION,
    // topDriverCount is a presentation cut; the full set is retained in the
    // result so nothing is silently discarded before persistence.
    drivers: records,
    evidence,
    evidenceQuality: summariseEvidenceQuality(allResolved),
    warnings,
    costReport: {
      candidates: candidates.length,
      attributed: records.length,
      counterfactualRuns,
      droppedByBudget,
      durationMs,
      exceededBudget,
    },
  };
}
