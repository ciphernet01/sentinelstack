/**
 * P1 — Canonical Input Hash Service
 *
 * Produces a deterministic SHA-256 fingerprint of the material state used
 * by a risk calculation.  The hash is stored on RiskRun.inputStateHash so
 * that any two runs with identical inputs produce identical hashes, and any
 * material change to the input produces a different hash.
 *
 * Contract:
 *  - Object keys are sorted recursively before serialisation.
 *  - BigInt values are converted to strings.
 *  - Timestamps are normalised to full ISO-8601 UTC strings.
 *  - Floating-point numbers are rounded to 10 significant figures.
 *  - The result is always prefixed with "sha256:".
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The canonical input bundle that is hashed for a risk run. */
export interface RiskInputBundle {
  organizationId: string;
  scopeType: string;
  scopeId: string;
  asOf: string; // ISO-8601 UTC
  riskEngineVersion: string;
  parameterVersion: string;
  modelBundleVersion: string;
  featureSetVersion: string;
  simulationConfigVersion: string;
  assets: CanonicalAsset[];
  vulnerabilities: CanonicalVulnerability[];
  controls: CanonicalControl[];
  telemetrySummary: TelemetrySummary;
  businessParameters: BusinessParameters;
  riskParameters: RiskParameters;
}

export interface CanonicalAsset {
  assetId: string;
  criticality: string;
  internetExposed: boolean;
  environment: string;
  revenueDependencyInr: string; // BigInt → string
  downtimeCostPerHourInr: string;
  maxTolerableDowntimeHours: number;
  dataSensitivity: number;
  regulatoryExposureInr: string;
  breachCostInr: string;
  recoveryCostInr: string;
  reputationCostInr: string;
  businessUnitId: string | null;
}

export interface CanonicalVulnerability {
  assetId: string;
  cve: string | null;
  cvss: number;
  epss: number;
  exploitAvailable: boolean;
  patchAvailable: boolean;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CanonicalControl {
  assetId: string;
  controlId: string;
  category: string;
  coveragePercent: number;
  effectivenessPercent: number;
  status: string;
}

export interface TelemetrySummary {
  windowDays: number;
  totalEventCount: number;
  criticalEventCount: number;
  highEventCount: number;
  averageSignalScore: number;
  sourceBreakdown: Record<string, number>;
}

export interface BusinessParameters {
  annualRevenueTotalInr: string;
  criticalAssetCount: number;
  businessUnitCount: number;
}

export interface RiskParameters {
  varPercentile: number; // e.g. 0.95
  horizon: string; // "ANNUAL"
  annualizationRule: string; // "365_DAY_WINDOW"
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function normaliseDate(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return value;
}

function normaliseBigInt(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

function normaliseFloat(value: unknown): unknown {
  if (typeof value === "number" && !Number.isInteger(value)) {
    // Round to 10 significant figures to avoid floating-point noise.
    return parseFloat(value.toPrecision(10));
  }
  return value;
}

function normaliseValue(value: unknown): unknown {
  value = normaliseBigInt(value);
  value = normaliseDate(value);
  value = normaliseFloat(value);
  return value;
}

/**
 * Recursively sorts object keys and normalises values so JSON.stringify
 * produces an identical string for semantically identical inputs.
 */
function canonicalise(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  if (typeof value === "object" && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalise(normaliseValue(obj[key]));
        return acc;
      }, {});
  }
  return normaliseValue(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic SHA-256 hash of a risk input bundle.
 *
 * @returns  "sha256:<hex-digest>"
 */
export function hashRiskInput(bundle: RiskInputBundle): string {
  const canonical = canonicalise(bundle);
  const json = JSON.stringify(canonical);
  const digest = createHash("sha256").update(json, "utf8").digest("hex");
  return `sha256:${digest}`;
}

/**
 * Compute a deterministic SHA-256 hash of a risk result bundle.
 * The result bundle can be any JSON-serialisable object.
 *
 * @returns  "sha256:<hex-digest>"
 */
export function hashRiskResult(result: unknown): string {
  const canonical = canonicalise(result);
  const json = JSON.stringify(canonical);
  const digest = createHash("sha256").update(json, "utf8").digest("hex");
  return `sha256:${digest}`;
}
