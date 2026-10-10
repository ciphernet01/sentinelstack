/**
 * P3 — Evidence Model
 *
 * Turns the opaque `evidenceRefs: string[]` produced by the P2 engine into
 * typed, source-linked evidence records that can be persisted, queried and
 * drilled into (P3 spec §11).
 *
 * The rules that matter:
 *   • Evidence is deduplicated per (organization, sourceType, sourceRecordId)
 *     so one source record cited by many drivers is stored once.
 *   • Freshness is measured against the RiskRun.asOf, not wall-clock now, so a
 *     re-run of a historical calculation reports the same age (spec §20).
 *   • Staleness is *surfaced*, never silently corrected, and it never becomes a
 *     hidden numeric risk multiplier (spec §19).
 */

import { hashRiskResult } from "../provenance/canonicalHash.service";
import type {
  RiskAssetContext,
  RiskDriver,
  RiskTelemetryContext,
  RiskVulnerabilityContext,
} from "./riskCalculationContext";
import type { RiskParameterBundle } from "./assumptions.service";

export const EVIDENCE_MODEL_VERSION = "evidence-v1";
export const DRIVER_KEY_VERSION = "driver-key-v1";
export const ATTRIBUTION_VERSION = "driver-attribution-v1";

/** Freshness windows per source class, in days. */
export const EVIDENCE_FRESHNESS_DAYS = Object.freeze({
  VULNERABILITY: 14,
  SIEM: 1,
  IAM: 7,
  EDR: 3,
  CSPM: 7,
  ASSET_INVENTORY: 30,
  THREAT_INTEL: 3,
  BUSINESS_CONTEXT: 90,
  MODEL: 365,
  CALCULATION: 365,
} as const);

/**
 * Canonical evidence source vocabulary.
 *
 * Declared explicitly rather than derived from the freshness map, so the type
 * stays a literal union that Prisma's enum accepts without a cast.
 */
export type EvidenceSourceTypeName =
  | "VULNERABILITY"
  | "SIEM"
  | "IAM"
  | "EDR"
  | "CSPM"
  | "ASSET_INVENTORY"
  | "THREAT_INTEL"
  | "BUSINESS_CONTEXT"
  | "MODEL"
  | "CALCULATION";

export const DEFAULT_FRESHNESS_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Source systems that are authoritative by construction. */
const RELIABLE_SOURCES = new Set([
  "VULNERABILITY",
  "EDR",
  "CSPM",
  "ASSET_INVENTORY",
  "BUSINESS_CONTEXT",
  "MODEL",
  "CALCULATION",
]);

export type EvidenceQualityState = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
export type EvidenceReliabilityState = "HIGH" | "MEDIUM" | "LOW";
export type DriverEvidenceRelationshipType =
  | "PRIMARY_SUPPORT"
  | "SECONDARY_SUPPORT"
  | "CONTEXT"
  | "MODEL_INPUT";

export interface EvidenceDraft {
  sourceType: EvidenceSourceTypeName;
  sourceRecordId: string;
  canonicalEntityType: string;
  canonicalEntityId: string;
  observedAt?: Date;
  collectedAt?: Date;
  sourceVersion?: string;
  reliability: EvidenceReliabilityState;
  metadata?: Record<string, unknown>;
}

export interface ResolvedEvidence extends EvidenceDraft {
  /** Days between observation and the calculation's as-of instant. */
  ageDays: number;
  quality: EvidenceQualityState;
  isStale: boolean;
  evidenceHash: string;
}

export interface EvidenceLink {
  sourceType: EvidenceSourceTypeName;
  sourceRecordId: string;
  relationshipType: DriverEvidenceRelationshipType;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Map a P2 `TelemetrySource` onto an evidence source class.
 *
 * The engine's source vocabulary and the governance vocabulary are not
 * identical, so the mapping is explicit rather than guessed at runtime — an
 * unmapped source degrades to SIEM (telemetry) rather than being mislabelled.
 */
export function evidenceSourceForTelemetry(source: string): EvidenceSourceTypeName {
  const normalised = source.toUpperCase();

  if (normalised.includes("VULN")) return "VULNERABILITY";
  if (normalised.includes("EDR") || normalised.includes("ENDPOINT")) return "EDR";
  if (normalised.includes("IAM") || normalised.includes("IDENTITY")) return "IAM";
  if (normalised.includes("CSPM") || normalised.includes("CLOUD")) return "CSPM";
  if (normalised.includes("SIEM") || normalised.includes("LOG")) return "SIEM";
  if (normalised.includes("THREAT") || normalised.includes("INTEL")) return "THREAT_INTEL";
  return "SIEM";
}

/** Reliability is a property of the source class, not of the observation. */
export function reliabilityForSource(sourceType: EvidenceSourceTypeName): EvidenceReliabilityState {
  return RELIABLE_SOURCES.has(sourceType) ? "HIGH" : "MEDIUM";
}

/**
 * Resolve freshness and quality for one evidence item.
 *
 * Age is measured against `asOf` so that re-running a historical calculation
 * reproduces the same quality state — otherwise a re-run months later would
 * silently downgrade evidence that was fresh at the time.
 */
export function resolveEvidence(draft: EvidenceDraft, asOf: Date): ResolvedEvidence {
  const windowDays = EVIDENCE_FRESHNESS_DAYS[draft.sourceType] ?? DEFAULT_FRESHNESS_DAYS;
  const observedAt = draft.observedAt ?? draft.collectedAt;
  const ageDays = observedAt
    ? clamp((asOf.getTime() - observedAt.getTime()) / DAY_MS, 0, Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER;

  const isStale = ageDays > windowDays;

  // No observation time means freshness cannot be assessed at all. That is a
  // different condition from "old evidence": it is unavailable, and must not be
  // presented as if we simply checked it and found it acceptable.
  const quality: EvidenceQualityState =
    draft.sourceRecordId.length === 0 || observedAt === undefined
      ? "UNAVAILABLE"
      : isStale
        ? "LOW"
        : ageDays > windowDays * 0.75
          ? "MEDIUM"
          : "HIGH";

  return {
    ...draft,
    ageDays,
    quality,
    isStale,
    evidenceHash: hashRiskResult({
      sourceType: draft.sourceType,
      sourceRecordId: draft.sourceRecordId,
      canonicalEntityType: draft.canonicalEntityType,
      canonicalEntityId: draft.canonicalEntityId,
      observedAt: observedAt ? observedAt.toISOString() : null,
      sourceVersion: draft.sourceVersion ?? null,
    }),
  };
}

/**
 * Build the evidence draft for one vulnerability, plus the owning asset.
 *
 * `asOf` is the calculation's instant, never wall-clock now. Deriving
 * `observedAt` from it is what makes a re-run of the same calculation produce
 * the same evidence hash, and therefore the same driver hash.
 */
export function evidenceForVulnerability(
  asset: RiskAssetContext,
  vulnerability: RiskVulnerabilityContext,
  asOf: Date
): EvidenceDraft[] {
  return [
    {
      sourceType: "VULNERABILITY",
      sourceRecordId: vulnerability.id,
      canonicalEntityType: "ASSET",
      canonicalEntityId: asset.assetId,
      observedAt: new Date(asOf.getTime() - vulnerability.ageDays * DAY_MS),
      reliability: "HIGH",
      metadata: {
        cve: vulnerability.cve,
        cvss: vulnerability.cvss,
        epss: vulnerability.epss,
        exploitAvailable: vulnerability.exploitAvailable,
        patchAvailable: vulnerability.patchAvailable,
        status: vulnerability.status,
      },
    },
    {
      sourceType: "ASSET_INVENTORY",
      sourceRecordId: asset.assetId,
      canonicalEntityType: "ASSET",
      canonicalEntityId: asset.assetId,
      reliability: "HIGH",
      metadata: {
        hostname: asset.hostname,
        serviceName: asset.serviceName,
        environment: asset.environment,
        internetExposed: asset.internetExposed,
      },
    },
  ];
}

/** Inventory evidence for an asset itself (exposure, criticality, ownership). */
export function evidenceForAsset(asset: RiskAssetContext): EvidenceDraft {
  return {
    sourceType: "ASSET_INVENTORY",
    sourceRecordId: asset.assetId,
    canonicalEntityType: "ASSET",
    canonicalEntityId: asset.assetId,
    reliability: "HIGH",
    metadata: {
      hostname: asset.hostname,
      serviceName: asset.serviceName,
      environment: asset.environment,
      criticality: asset.criticality,
      internetExposed: asset.internetExposed,
      revenueDependencyInr: asset.revenueDependencyInr,
      dataSensitivity: asset.dataSensitivity,
    },
  };
}

/** Build the evidence draft for one telemetry observation. */
export function evidenceForTelemetry(
  asset: RiskAssetContext,
  event: RiskTelemetryContext
): EvidenceDraft {
  const sourceType = evidenceSourceForTelemetry(event.source);
  return {
    sourceType,
    sourceRecordId: event.id,
    canonicalEntityType: "ASSET",
    canonicalEntityId: asset.assetId,
    observedAt: new Date(event.observedAt),
    reliability: reliabilityForSource(sourceType),
    metadata: {
      eventType: event.eventType,
      severity: event.severity,
      signalScore: event.signalScore,
      source: event.source,
    },
  };
}

/** The calculation itself is evidence: it explains the number itself. */
export function evidenceForCalculation(
  riskRunId: string,
  resultHash: string,
  engineVersion: string
): EvidenceDraft {
  return {
    sourceType: "CALCULATION",
    sourceRecordId: riskRunId,
    canonicalEntityType: "RISK_RUN",
    canonicalEntityId: riskRunId,
    reliability: "HIGH",
    sourceVersion: engineVersion,
    metadata: { resultHash },
  };
}

/** Business-impact context is evidence for BUSINESS_IMPACT drivers. */
export function evidenceForBusinessImpact(asset: RiskAssetContext): EvidenceDraft {
  return {
    sourceType: "BUSINESS_CONTEXT",
    sourceRecordId: asset.assetId,
    canonicalEntityType: "ASSET",
    canonicalEntityId: asset.assetId,
    reliability: "HIGH",
    sourceVersion: asset.businessImpact.parameterVersion,
    metadata: {
      downtimeCostPerHour: asset.businessImpact.downtimeCostPerHour,
      maxTolerableDowntimeHours: asset.businessImpact.maxTolerableDowntimeHours,
      breachCost: asset.businessImpact.breachCost,
      recoveryCost: asset.businessImpact.recoveryCost,
      regulatoryExposure: asset.businessImpact.regulatoryExposure,
      reputationCost: asset.businessImpact.reputationCost,
      currency: asset.businessImpact.currency,
    },
  };
}

/**
 * Deduplicate evidence drafts by their natural key.
 *
 * Two drafts for the same source record are the same evidence; keeping the
 * first preserves the order drivers were generated in, which keeps the
 * attribution deterministic.
 */
export function dedupeEvidence(drafts: EvidenceDraft[]): EvidenceDraft[] {
  const seen = new Set<string>();
  const result: EvidenceDraft[] = [];

  for (const draft of drafts) {
    const key = `${draft.sourceType}:${draft.sourceRecordId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(draft);
  }

  return result;
}

/** Stale-evidence counts for a set of resolved evidence, for disclosure. */
export function summariseEvidenceQuality(evidence: ResolvedEvidence[]): {
  total: number;
  stale: number;
  unavailable: number;
  byQuality: Record<EvidenceQualityState, number>;
} {
  const byQuality: Record<EvidenceQualityState, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNAVAILABLE: 0,
  };

  let stale = 0;
  for (const item of evidence) {
    byQuality[item.quality] += 1;
    if (item.isStale) stale += 1;
  }

  return {
    total: evidence.length,
    stale,
    unavailable: byQuality.UNAVAILABLE,
    byQuality,
  };
}

/** Evidence quality never becomes a rupee amount (P3 spec §7.4). */
export function evidenceToLinks(
  evidence: ResolvedEvidence[],
  relationshipType: DriverEvidenceRelationshipType
): EvidenceLink[] {
  return evidence.map((item) => ({
    sourceType: item.sourceType,
    sourceRecordId: item.sourceRecordId,
    relationshipType,
  }));
}

/**
 * Fold a driver's evidence quality into its confidence.
 *
 * A driver with no evidence is never HIGH confidence. Stale evidence caps
 * confidence at LOW. This is a *ceiling*, not a score: good evidence cannot
 * manufacture confidence the attribution method did not earn.
 */
export function capConfidenceByEvidence(
  attributionConfidence: RiskDriver["confidence"],
  evidence: ResolvedEvidence[]
): RiskDriver["confidence"] {
  if (evidence.length === 0) return "INSUFFICIENT";
  if (evidence.every((item) => item.quality === "UNAVAILABLE")) return "INSUFFICIENT";
  if (evidence.some((item) => item.isStale)) return "LOW";
  if (attributionConfidence === "INSUFFICIENT") return "INSUFFICIENT";
  if (attributionConfidence === "LOW") return "LOW";
  return attributionConfidence;
}

/** Parameters are accepted so freshness policy can become policy-driven. */
export function evidencePolicyFrom(
  parameters: RiskParameterBundle
): { parameterVersion: string; defaultWindowDays: number } {
  return {
    parameterVersion: parameters.parameterVersion,
    defaultWindowDays: DEFAULT_FRESHNESS_DAYS,
  };
}
