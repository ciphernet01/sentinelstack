/**
 * P0.3 — Deterministic risk fixture loader.
 *
 * Assembles the synthetic ACME-test digital twin from the JSON fixtures into
 * the canonical `RiskInputBundle` shape consumed by `hashRiskInput`.
 *
 * The loader is deliberately pure and dependency-free so the same bundle can
 * be produced byte-for-byte in any environment (CI, dev, review).
 */

import type { RiskInputBundle } from "../../src/services/provenance/canonicalHash.service";

import enterprise from "../fixtures/risk/enterprise.json";
import assetFixture from "../fixtures/risk/assets.json";
import vulnerabilityFixture from "../fixtures/risk/vulnerabilities.json";
import controlFixture from "../fixtures/risk/controls.json";
import telemetryFixture from "../fixtures/risk/telemetry.json";

export const FIXTURE_ORG_ID = enterprise.organizationId;
export const FIXTURE_AS_OF = telemetryFixture.asOf;

export interface FixtureBundleOptions {
  /** Override any version field to test calculation-identity sensitivity. */
  riskEngineVersion?: string;
  parameterVersion?: string;
  modelBundleVersion?: string;
  featureSetVersion?: string;
  simulationConfigVersion?: string;
  /** Override the as-of timestamp. */
  asOf?: string;
  /** Apply an arbitrary material mutation for "hash must change" tests. */
  mutate?: (bundle: RiskInputBundle) => RiskInputBundle;
}

/** Build the canonical input bundle from the on-disk fixtures. */
export function buildFixtureBundle(options: FixtureBundleOptions = {}): RiskInputBundle {
  const assets = assetFixture.assets.map((asset) => ({
    assetId: asset.assetId,
    criticality: asset.criticality,
    internetExposed: asset.internetExposed,
    environment: asset.environment,
    revenueDependencyInr: String(asset.revenueDependencyInr),
    downtimeCostPerHourInr: String(asset.downtimeCostPerHourInr),
    maxTolerableDowntimeHours: asset.maxTolerableDowntimeHours,
    dataSensitivity: asset.dataSensitivity,
    regulatoryExposureInr: String(asset.regulatoryExposureInr),
    breachCostInr: String(asset.breachCostInr),
    recoveryCostInr: String(asset.recoveryCostInr),
    reputationCostInr: String(asset.reputationCostInr),
    businessUnitId: asset.businessUnitId ?? null,
  }));

  const vulnerabilities = vulnerabilityFixture.vulnerabilities.map((vulnerability) => ({
    assetId: vulnerability.assetId,
    cve: vulnerability.cve ?? null,
    cvss: vulnerability.cvss,
    epss: vulnerability.epss,
    exploitAvailable: vulnerability.exploitAvailable,
    patchAvailable: vulnerability.patchAvailable,
    status: vulnerability.status,
    firstSeenAt: vulnerability.firstSeenAt,
    lastSeenAt: vulnerability.lastSeenAt,
  }));

  const controlById = new Map(controlFixture.controls.map((control) => [control.controlId, control]));
  const controls = controlFixture.assetControls.map((mapping) => {
    const control = controlById.get(mapping.controlId);
    if (!control) throw new Error(`Fixture control ${mapping.controlId} is not defined`);
    return {
      assetId: mapping.assetId,
      controlId: control.controlId,
      category: control.category,
      coveragePercent: mapping.coveragePercent,
      effectivenessPercent: mapping.effectivenessPercent,
      status: mapping.status,
    };
  });

  const sourceBreakdown: Record<string, number> = {};
  for (const event of telemetryFixture.telemetry) {
    sourceBreakdown[event.source] = (sourceBreakdown[event.source] ?? 0) + 1;
  }

  const telemetrySummary = {
    windowDays: telemetryFixture.windowDays,
    totalEventCount: telemetryFixture.telemetry.length,
    criticalEventCount: telemetryFixture.telemetry.filter((e) => e.severity === "CRITICAL").length,
    highEventCount: telemetryFixture.telemetry.filter((e) => e.severity === "HIGH").length,
    averageSignalScore:
      telemetryFixture.telemetry.reduce((sum, e) => sum + e.signalScore, 0) /
      telemetryFixture.telemetry.length,
    sourceBreakdown,
  };

  const annualRevenueTotalInr = enterprise.businessUnits.reduce(
    (sum, unit) => sum + BigInt(unit.annualRevenueInr),
    BigInt(0),
  );

  const bundle: RiskInputBundle = {
    organizationId: FIXTURE_ORG_ID,
    scopeType: "ENTERPRISE",
    scopeId: FIXTURE_ORG_ID,
    asOf: options.asOf ?? FIXTURE_AS_OF,
    riskEngineVersion: options.riskEngineVersion ?? "deterministic-baseline-v0",
    parameterVersion: options.parameterVersion ?? "params-2026-09",
    modelBundleVersion: options.modelBundleVersion ?? "deterministic-baseline-v0",
    featureSetVersion: options.featureSetVersion ?? "features-v1",
    simulationConfigVersion: options.simulationConfigVersion ?? "mc-config-v1",
    assets,
    vulnerabilities,
    controls,
    telemetrySummary,
    businessParameters: {
      annualRevenueTotalInr: annualRevenueTotalInr.toString(),
      criticalAssetCount: assets.filter(
        (a) => a.criticality === "CRITICAL" || a.criticality === "HIGH",
      ).length,
      businessUnitCount: enterprise.businessUnits.length,
    },
    riskParameters: {
      varPercentile: 0.95,
      horizon: "ANNUAL",
      annualizationRule: "365_DAY_WINDOW",
    },
  };

  return options.mutate ? options.mutate(bundle) : bundle;
}

/** Deep clone helper that preserves the exact fixture shape. */
export function cloneBundle(bundle: RiskInputBundle): RiskInputBundle {
  return JSON.parse(JSON.stringify(bundle)) as RiskInputBundle;
}
