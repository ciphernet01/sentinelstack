/**
 * P2 — Risk Driver Attribution
 *
 * Separates a *risk driver* (a factor that moves the loss) from a *high-risk
 * asset* (a location where loss sits).  P3 builds richer evidence linking on
 * top of this; P2 must already store real contributions rather than a sorted
 * list of assets.
 *
 * Method: COUNTERFACTUAL_V1 — remove one factor, recompute the enterprise
 * expected loss analytically (lambda x E[severity]), and attribute the delta.
 * This is deterministic, cheap and explainable, and it does not require a
 * fresh Monte Carlo run per counterfactual.
 */

import type {
  RiskAssetContext,
  RiskDependencyContext,
  RiskDriver,
  RiskDriverType,
} from "./riskCalculationContext";
import type { RiskParameterBundle } from "./assumptions.service";
import { aggregateEnterpriseSignals, type EventClass } from "./evidenceSignals.service";
import {
  composeSeverityScale,
  dominantSeverityComponent,
  expectedSeverity,
} from "./severity.service";
import { computeBlastRadiusMap } from "./dependency.service";

export const DRIVER_ATTRIBUTION_METHOD = "COUNTERFACTUAL_V1";

const MAX_DRIVERS_PER_TYPE = 5;

// ---------------------------------------------------------------------------
// Analytic expected loss (no simulation)
// ---------------------------------------------------------------------------

export interface AnalyticEventClassLoss {
  eventClass: EventClass;
  annualFrequency: number;
  expectedLoss: number;
  perAsset: Array<{ assetId: string; expectedLoss: number }>;
}

export interface AnalyticLossResult {
  byEventClass: AnalyticEventClassLoss[];
  enterpriseEal: number;
}

/**
 * Analytic enterprise expected annual loss.
 *
 * EAL = sum over classes, then assets, of (lambda_asset x E[severity_asset,class])
 *
 * Allocation of a class's annual rate to assets follows the same proportional
 * rule used by the Monte Carlo engine, so the analytic and simulated figures
 * stay consistent in the limit.
 */
export function analyticEnterpriseLoss(
  assets: RiskAssetContext[],
  dependencies: RiskDependencyContext[],
  parameters: RiskParameterBundle
): AnalyticLossResult {
  const signals = aggregateEnterpriseSignals(assets, parameters);
  const blastRadius = computeBlastRadiusMap(
    assets.map((asset) => asset.assetId),
    dependencies,
    parameters
  );
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));

  const byEventClass: AnalyticEventClassLoss[] = [];

  for (const signal of signals) {
    const contributions = signal.assetContributions.filter(
      (contribution) => contribution.adjustedSignal > 0
    );

    if (contributions.length === 0) {
      byEventClass.push({
        eventClass: signal.eventClass,
        annualFrequency: 0,
        expectedLoss: 0,
        perAsset: [],
      });
      continue;
    }

    const totalContribution = contributions.reduce(
      (sum, contribution) => sum + contribution.adjustedSignal,
      0
    );

    const perAsset: Array<{ assetId: string; expectedLoss: number }> = [];

    for (const contribution of contributions) {
      const asset = assetById.get(contribution.assetId);
      if (!asset) continue;

      const multiplier = blastRadius.get(contribution.assetId)?.multiplier ?? 1;
      const scale = composeSeverityScale(asset, signal.eventClass, parameters, multiplier);

      const assetFrequency =
        totalContribution > 0
          ? (contribution.adjustedSignal / totalContribution) * signal.adjustedSignal
          : 0;

      perAsset.push({
        assetId: contribution.assetId,
        expectedLoss: assetFrequency * expectedSeverity(scale),
      });
    }

    byEventClass.push({
      eventClass: signal.eventClass,
      annualFrequency: signal.adjustedSignal,
      expectedLoss: perAsset.reduce((sum, entry) => sum + entry.expectedLoss, 0),
      perAsset,
    });
  }

  return {
    byEventClass,
    enterpriseEal: byEventClass.reduce((sum, entry) => sum + entry.expectedLoss, 0),
  };
}

// ---------------------------------------------------------------------------
// Counterfactual mutations
// ---------------------------------------------------------------------------

export interface CounterfactualState {
  assets: RiskAssetContext[];
  dependencies: RiskDependencyContext[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Mirror of the control-effectiveness formula used when building evidence. */
export function recomputeControlEffectiveness(asset: RiskAssetContext): number {
  if (asset.controls.length === 0) return 0;
  const total = asset.controls.reduce(
    (sum, control) => sum + clamp01(control.coverage) * clamp01(control.effectiveness),
    0
  );
  return clamp01(total / asset.controls.length);
}

export function withoutAsset(state: CounterfactualState, assetId: string): CounterfactualState {
  return {
    assets: state.assets.filter((asset) => asset.assetId !== assetId),
    dependencies: state.dependencies.filter(
      (dependency) =>
        dependency.sourceAssetId !== assetId && dependency.targetAssetId !== assetId
    ),
  };
}

export function withoutInternetExposure(state: CounterfactualState): CounterfactualState {
  return {
    assets: state.assets.map((asset) =>
      asset.internetExposed ? { ...asset, internetExposed: false } : asset
    ),
    dependencies: state.dependencies,
  };
}

export function withoutVulnerabilities(state: CounterfactualState): CounterfactualState {
  return {
    assets: state.assets.map((asset) => ({
      ...asset,
      vulnerabilities: asset.vulnerabilities.map((vulnerability) => ({
        ...vulnerability,
        exploitAvailable: false,
        patchAvailable: true,
      })),
    })),
    dependencies: state.dependencies,
  };
}

export function withoutTelemetryForSource(
  state: CounterfactualState,
  source: string
): CounterfactualState {
  return {
    assets: state.assets.map((asset) => ({
      ...asset,
      telemetry: asset.telemetry.filter((event) => event.source !== source),
    })),
    dependencies: state.dependencies,
  };
}

export function withClosedControlCategory(
  state: CounterfactualState,
  category: string
): CounterfactualState {
  return {
    assets: state.assets.map((asset) => {
      if (!asset.controls.some((control) => control.category === category)) return asset;

      const controls = asset.controls.map((control) =>
        control.category === category
          ? { ...control, coverage: 1, effectiveness: 1, status: "IMPLEMENTED" }
          : control
      );

      const next: RiskAssetContext = { ...asset, controls };
      return { ...next, controlEffectiveness: recomputeControlEffectiveness(next) };
    }),
    dependencies: state.dependencies,
  };
}

export function withoutControlCategory(
  state: CounterfactualState,
  category: string
): CounterfactualState {
  return {
    assets: state.assets.map((asset) => {
      if (!asset.controls.some((control) => control.category === category)) return asset;

      const controls = asset.controls.filter((control) => control.category !== category);
      const next: RiskAssetContext = { ...asset, controls };
      return { ...next, controlEffectiveness: recomputeControlEffectiveness(next) };
    }),
    dependencies: state.dependencies,
  };
}

export function withoutDependencyAmplification(state: CounterfactualState): CounterfactualState {
  return { assets: state.assets, dependencies: [] };
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export interface AttributionInput {
  assets: RiskAssetContext[];
  dependencies: RiskDependencyContext[];
  parameters: RiskParameterBundle;
  /** Authoritative EAL from the Monte Carlo engine. */
  baselineEal: number;
  /**
   * VaR95 from the Monte Carlo engine.  Optional: the analytic counterfactual
   * does not consume it, and P3 tail attribution will.  Accepted here so the
   * engine can hand the whole result set over in one call.
   */
  baselineVar95?: number;
}

function driverId(type: RiskDriverType, ref: string): string {
  return `driver:${type.toLowerCase()}:${ref}`;
}

function controlRefs(assets: RiskAssetContext[], category: string): string[] {
  return assets
    .flatMap((asset) => asset.controls)
    .filter((control) => control.category === category)
    .map((control) => control.controlId);
}

/**
 * Produce the authoritative driver list for a completed calculation.
 *
 * Every driver's contribution is a measured counterfactual delta against the
 * analytic expected loss, never an assertion.  Evidence references are carried
 * through so P3 can attach full provenance.
 */
export function attributeDrivers(input: AttributionInput): RiskDriver[] {
  const { assets, dependencies, parameters, baselineEal } = input;
  const state: CounterfactualState = { assets, dependencies };
  const drivers: RiskDriver[] = [];

  const analyticEal = (next: CounterfactualState): number =>
    analyticEnterpriseLoss(next.assets, next.dependencies, parameters).enterpriseEal;

  const baselineAnalytic = analyticEal(state);
  // Rescale analytic deltas onto the simulated EAL the engine reported.
  const scale = baselineAnalytic > 0 ? baselineEal / baselineAnalytic : 0;

  // ── EXPOSURE ─────────────────────────────────────────────────────────────
  const exposedAssets = assets.filter((asset) => asset.internetExposed);
  if (exposedAssets.length > 0) {
    const contribution = baselineAnalytic - analyticEal(withoutInternetExposure(state));
    if (contribution > 0) {
      drivers.push({
        id: driverId("EXPOSURE", "internet"),
        type: "EXPOSURE",
        entityRef: "enterprise",
        name: `Internet exposure on ${exposedAssets.length} asset(s)`,
        contributionToEal: contribution * scale,
        direction: "INCREASES_RISK",
        confidence: "MEDIUM",
        evidenceRefs: exposedAssets.map((asset) => asset.assetId),
      });
    }
  }

  // ── VULNERABILITY ────────────────────────────────────────────────────────
  const exploitableRefs = assets.flatMap((asset) =>
    asset.vulnerabilities.filter((vulnerability) => vulnerability.exploitAvailable).map((vulnerability) => vulnerability.id)
  );
  if (exploitableRefs.length > 0) {
    const contribution = baselineAnalytic - analyticEal(withoutVulnerabilities(state));
    if (contribution > 0) {
      drivers.push({
        id: driverId("VULNERABILITY", "exploitable"),
        type: "VULNERABILITY",
        entityRef: "enterprise",
        name: `${exploitableRefs.length} exploitable vulnerability(ies) across the estate`,
        contributionToEal: contribution * scale,
        direction: "INCREASES_RISK",
        confidence: "HIGH",
        evidenceRefs: exploitableRefs.slice(0, 50),
      });
    }
  }

  // ── DEPENDENCY ───────────────────────────────────────────────────────────
  if (dependencies.length > 0) {
    const contribution = baselineAnalytic - analyticEal(withoutDependencyAmplification(state));
    if (contribution > 0) {
      drivers.push({
        id: driverId("DEPENDENCY", "blast-radius"),
        type: "DEPENDENCY",
        entityRef: "enterprise",
        name: "Blast radius through service and data dependencies",
        contributionToEal: contribution * scale,
        direction: "INCREASES_RISK",
        confidence: "LOW",
        evidenceRefs: dependencies.map(
          (dependency) => `${dependency.sourceAssetId}->${dependency.targetAssetId}`
        ),
      });
    }
  }

  // ── CONTROL: gaps increase risk, fully effective controls reduce it ──────
  const controlCategories = Array.from(
    new Set(assets.flatMap((asset) => asset.controls.map((control) => control.category)))
  );

  for (const category of controlCategories) {
    const gapContribution = baselineAnalytic - analyticEal(withClosedControlCategory(state, category));

    if (gapContribution > 0) {
      drivers.push({
        id: driverId("CONTROL", `${category}-gap`),
        type: "CONTROL",
        entityRef: category,
        name: `${category} control gap`,
        contributionToEal: gapContribution * scale,
        direction: "INCREASES_RISK",
        confidence: "HIGH",
        evidenceRefs: controlRefs(assets, category),
      });
      continue;
    }

    // Already fully effective: measure the loss it currently avoids.
    const avoidedLoss = analyticEal(withoutControlCategory(state, category));
    if (avoidedLoss > baselineAnalytic) {
      drivers.push({
        id: driverId("CONTROL", `${category}-effective`),
        type: "CONTROL",
        entityRef: category,
        name: `${category} control effectiveness`,
        contributionToEal: (avoidedLoss - baselineAnalytic) * scale,
        direction: "REDUCES_RISK",
        confidence: "HIGH",
        evidenceRefs: controlRefs(assets, category),
      });
    }
  }

  // ── THREAT / MODEL_SIGNAL (telemetry-derived) ────────────────────────────
  const telemetrySources = Array.from(
    new Set(assets.flatMap((asset) => asset.telemetry.map((event) => event.source)))
  );

  for (const source of telemetrySources) {
    const contribution = baselineAnalytic - analyticEal(withoutTelemetryForSource(state, source));
    if (contribution <= 0) continue;

    const refs = assets.flatMap((asset) =>
      asset.telemetry.filter((event) => event.source === source).map((event) => event.id)
    );

    drivers.push({
      id: driverId("MODEL_SIGNAL", `${source}-telemetry`),
      type: "MODEL_SIGNAL",
      entityRef: source,
      name: `${source} telemetry pressure`,
      contributionToEal: contribution * scale,
      direction: "INCREASES_RISK",
      confidence: "MEDIUM",
      evidenceRefs: refs.slice(0, 50),
    });
  }

  // ── BUSINESS_IMPACT (per material asset, dominant loss component) ────────
  const analytic = analyticEnterpriseLoss(assets, dependencies, parameters);
  const assetTotals = new Map<string, number>();

  for (const eventClassLoss of analytic.byEventClass) {
    for (const entry of eventClassLoss.perAsset) {
      assetTotals.set(entry.assetId, (assetTotals.get(entry.assetId) ?? 0) + entry.expectedLoss);
    }
  }

  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const topAssets = Array.from(assetTotals.entries())
    .filter((entry) => entry[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DRIVERS_PER_TYPE);

  for (const [assetId, expectedLoss] of topAssets) {
    const asset = assetById.get(assetId);
    if (!asset) continue;

    // The class this asset contributes most to, within the enterprise mix.
    let dominantClass: EventClass | null = null;
    let dominantLoss = 0;

    for (const eventClassLoss of analytic.byEventClass) {
      const entry = eventClassLoss.perAsset.find((candidate) => candidate.assetId === assetId);
      if (entry && entry.expectedLoss > dominantLoss) {
        dominantLoss = entry.expectedLoss;
        dominantClass = eventClassLoss.eventClass;
      }
    }

    if (!dominantClass) continue;

    const component = dominantSeverityComponent(
      composeSeverityScale(asset, dominantClass, parameters, 1)
    );

    drivers.push({
      id: driverId("BUSINESS_IMPACT", assetId),
      type: "BUSINESS_IMPACT",
      entityRef: assetId,
      name: component
        ? `${asset.serviceName}: ${component.component} exposure`
        : `${asset.serviceName}: modelled business impact`,
      contributionToEal: expectedLoss * scale,
      direction: "INCREASES_RISK",
      confidence: "MEDIUM",
      evidenceRefs: [assetId],
    });
  }

  // ── Rank: risk-increasing drivers first, mitigations after ───────────────
  const increasing = drivers
    .filter((driver) => driver.direction === "INCREASES_RISK")
    .sort((a, b) => (b.contributionToEal ?? 0) - (a.contributionToEal ?? 0));

  const reducing = drivers
    .filter((driver) => driver.direction === "REDUCES_RISK")
    .sort((a, b) => (b.contributionToEal ?? 0) - (a.contributionToEal ?? 0));

  return [...increasing, ...reducing];
}
