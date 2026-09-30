/**
 * P1 — Evidence Context Service
 *
 * Loads and validates the point-in-time state for a risk run.
 * Produces a canonical input bundle that is then hashed and passed
 * to the risk calculation pipeline.
 *
 * Responsibilities:
 *  - validate organisation membership
 *  - resolve assets, vulnerabilities, controls, telemetry, business context
 *  - calculate coverage metadata
 *  - produce a canonical RiskInputBundle
 *  - produce an inputStateHash
 */

import { prisma } from "../../config/db";
import type { RiskInputBundle, TelemetrySummary } from "../provenance/canonicalHash.service";
import { hashRiskInput } from "../provenance/canonicalHash.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceContextOptions {
  organizationId: string;
  scopeType?: "ENTERPRISE" | "BUSINESS_UNIT" | "ASSET";
  scopeId?: string;
  asOf?: Date;
  telemetryWindowDays?: number;
  riskEngineVersion?: string;
  parameterVersion?: string;
  modelBundleVersion?: string;
  featureSetVersion?: string;
  simulationConfigVersion?: string;
}

export interface EvidenceContext {
  bundle: RiskInputBundle;
  inputStateHash: string;
  coverageState: CoverageState;
}

/**
 * Data coverage captured at calculation time.
 *
 * Persisted on the RiskRun and surfaced in the `_provenance` envelope so a
 * consumer can tell whether a result was computed from complete evidence or
 * from a partially-populated digital twin.
 */
export interface CoverageState {
  assetCount: number;
  vulnerabilityCount: number;
  controlCount: number;
  telemetryEventCount: number;
  hasTelemetry: boolean;
  hasVulnerabilities: boolean;
  hasControls: boolean;
}

/** Pure builder for the coverage contract — kept separate so it is testable. */
export function buildCoverageState(counts: {
  assetCount: number;
  vulnerabilityCount: number;
  controlCount: number;
  telemetryEventCount: number;
}): CoverageState {
  return {
    assetCount: counts.assetCount,
    vulnerabilityCount: counts.vulnerabilityCount,
    controlCount: counts.controlCount,
    telemetryEventCount: counts.telemetryEventCount,
    hasTelemetry: counts.telemetryEventCount > 0,
    hasVulnerabilities: counts.vulnerabilityCount > 0,
    hasControls: counts.controlCount > 0,
  };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  scopeType: "ENTERPRISE" as const,
  telemetryWindowDays: 30,
  riskEngineVersion: "deterministic-baseline-v0",
  parameterVersion: "params-2026-09",
  modelBundleVersion: "deterministic-baseline-v0",
  featureSetVersion: "features-v1",
  simulationConfigVersion: "mc-config-v1",
  varPercentile: 0.95,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function buildEvidenceContext(
  opts: EvidenceContextOptions
): Promise<EvidenceContext> {
  const {
    organizationId,
    scopeType = DEFAULTS.scopeType,
    scopeId = organizationId,
    asOf = new Date(),
    telemetryWindowDays = DEFAULTS.telemetryWindowDays,
    riskEngineVersion = DEFAULTS.riskEngineVersion,
    parameterVersion = DEFAULTS.parameterVersion,
    modelBundleVersion = DEFAULTS.modelBundleVersion,
    featureSetVersion = DEFAULTS.featureSetVersion,
    simulationConfigVersion = DEFAULTS.simulationConfigVersion,
  } = opts;

  const telemetryWindowStart = new Date(asOf);
  telemetryWindowStart.setDate(telemetryWindowStart.getDate() - telemetryWindowDays);

  // ── Resolve assets ───────────────────────────────────────────────────────
  const assets = await prisma.cyberAsset.findMany({
    where: { organizationId },
    include: {
      vulnerabilities: { where: { status: { not: "RESOLVED" } } },
      controls: { include: { control: true } },
      telemetry: {
        where: { observedAt: { gte: telemetryWindowStart, lte: asOf } },
      },
      businessUnit: { select: { id: true, annualRevenueInr: true, criticality: true } },
    },
  });

  // ── Resolve organisation business parameters ────────────────────────────
  const businessUnits = await prisma.businessUnit.findMany({
    where: { organizationId },
    select: { id: true, annualRevenueInr: true, criticality: true },
  });

  const annualRevenueTotalInr = businessUnits.reduce(
    (acc, bu) => acc + BigInt(bu.annualRevenueInr),
    BigInt(0)
  );

  const criticalAssetCount = assets.filter(
    (a) => a.criticality === "CRITICAL" || a.criticality === "HIGH"
  ).length;

  // ── Build telemetry summary ──────────────────────────────────────────────
  const allTelemetry = assets.flatMap((a) => a.telemetry);
  const sourceBreakdown: Record<string, number> = {};
  allTelemetry.forEach((t) => {
    sourceBreakdown[t.source] = (sourceBreakdown[t.source] ?? 0) + 1;
  });

  const telemetrySummary: TelemetrySummary = {
    windowDays: telemetryWindowDays,
    totalEventCount: allTelemetry.length,
    criticalEventCount: allTelemetry.filter((t) => t.severity === "CRITICAL").length,
    highEventCount: allTelemetry.filter((t) => t.severity === "HIGH").length,
    averageSignalScore:
      allTelemetry.length > 0
        ? allTelemetry.reduce((s, t) => s + t.signalScore, 0) / allTelemetry.length
        : 0,
    sourceBreakdown,
  };

  // ── Build canonical asset list ───────────────────────────────────────────
  const canonicalAssets = assets.map((a) => ({
    assetId: a.assetId,
    criticality: a.criticality,
    internetExposed: a.internetExposed,
    environment: a.environment,
    revenueDependencyInr: a.revenueDependencyInr.toString(),
    downtimeCostPerHourInr: a.downtimeCostPerHourInr.toString(),
    maxTolerableDowntimeHours: a.maxTolerableDowntimeHours,
    dataSensitivity: a.dataSensitivity,
    regulatoryExposureInr: a.regulatoryExposureInr.toString(),
    breachCostInr: a.breachCostInr.toString(),
    recoveryCostInr: a.recoveryCostInr.toString(),
    reputationCostInr: a.reputationCostInr.toString(),
    businessUnitId: a.businessUnitId ?? null,
  }));

  // ── Build canonical vulnerability list ──────────────────────────────────
  const canonicalVulnerabilities = assets.flatMap((a) =>
    a.vulnerabilities.map((v) => ({
      assetId: a.assetId,
      cve: v.cve ?? null,
      cvss: v.cvss,
      epss: v.epss,
      exploitAvailable: v.exploitAvailable,
      patchAvailable: v.patchAvailable,
      status: v.status,
      firstSeenAt: v.firstSeenAt.toISOString(),
      lastSeenAt: v.lastSeenAt.toISOString(),
    }))
  );

  // ── Build canonical control list ─────────────────────────────────────────
  const canonicalControls = assets.flatMap((a) =>
    a.controls.map((c) => ({
      assetId: a.assetId,
      controlId: c.control.controlId,
      category: c.control.category,
      coveragePercent: c.coveragePercent,
      effectivenessPercent: c.effectivenessPercent,
      status: c.status,
    }))
  );

  // ── Assemble the bundle ───────────────────────────────────────────────────
  const bundle: RiskInputBundle = {
    organizationId,
    scopeType,
    scopeId,
    asOf: asOf.toISOString(),
    riskEngineVersion,
    parameterVersion,
    modelBundleVersion,
    featureSetVersion,
    simulationConfigVersion,
    assets: canonicalAssets,
    vulnerabilities: canonicalVulnerabilities,
    controls: canonicalControls,
    telemetrySummary,
    businessParameters: {
      annualRevenueTotalInr: annualRevenueTotalInr.toString(),
      criticalAssetCount,
      businessUnitCount: businessUnits.length,
    },
    riskParameters: {
      varPercentile: DEFAULTS.varPercentile,
      horizon: "ANNUAL",
      annualizationRule: "365_DAY_WINDOW",
    },
  };

  const inputStateHash = hashRiskInput(bundle);

  const coverageState = buildCoverageState({
    assetCount: assets.length,
    vulnerabilityCount: canonicalVulnerabilities.length,
    controlCount: canonicalControls.length,
    telemetryEventCount: allTelemetry.length,
  });

  return { bundle, inputStateHash, coverageState };
}
