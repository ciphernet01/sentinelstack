/**
 * P2 — Monte Carlo Risk Engine v2
 *
 * The authoritative calculation pipeline:
 *
 *   evidence signals -> likelihood estimates -> frequency -> severity scales
 *   (with blast radius) -> Monte Carlo aggregate annual loss -> drivers
 *   -> product risk score -> result hash
 *
 * Every stage is versioned and every random draw comes from a seeded source, so
 * a result can be re-derived exactly from (inputStateHash, versions, seed).
 *
 * Anti-double-counting is structural:
 *   - each loss component has exactly one data-model owner (severity.service);
 *   - event classes apply component weights instead of adding new amounts;
 *   - blast radius amplifies one asset's severity once, rather than creating
 *     several independent losses for a shared dependency.
 */

import { hashRiskResult } from "../provenance/canonicalHash.service";
import type { RiskCalculationContext, RiskCalculationResult, RiskDriver } from "./riskCalculationContext";
import {
  aggregateEnterpriseSignals,
  type EnterpriseEventSignal,
} from "./evidenceSignals.service";
import {
  deterministicLikelihoodProvider,
  type LikelihoodEstimate,
} from "./likelihood.service";
import { probabilityToAnnualFrequency } from "./frequency.service";
import { computeBlastRadiusMap } from "./dependency.service";
import {
  composeSeverityScale,
  severityComponentAmounts,
  type SeverityScale,
} from "./severity.service";
import {
  simulateAggregateAnnualLoss,
  type EventClassModel,
} from "./lossDistribution.service";
import {
  createSeededRandom,
  PRODUCTION_MIN_SIMULATIONS,
} from "./simulationConfig.service";
import { calculateRiskScore } from "./riskScore.service";
import { analyticEnterpriseLoss, attributeDrivers } from "./driverAttribution.service";

export const RISK_ENGINE_VERSION_V2 = "risk-engine-v2.0";
export const COVERAGE_STATE_VERSION = "coverage-v2";

const CONFIDENCE_RANK: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INSUFFICIENT: 0,
};

/** A modelled stage output, kept so the result can disclose how it was derived. */
export interface ModelledEventClass {
  eventClass: string;
  rawSignal: number;
  adjustedSignal: number;
  likelihood: LikelihoodEstimate;
  annualFrequency: number;
  horizonProbability: number;
  cappedProbability: boolean;
  boundaryPolicy: string | null;
  expectedAnnualLoss: number;
  modelledAssets: number;
}

/** Worst confidence across estimates (a chain is as strong as its weakest link). */
export function aggregateConfidence(estimates: LikelihoodEstimate[]): string {
  if (estimates.length === 0) return "INSUFFICIENT";
  return estimates.reduce(
    (worst, estimate) =>
      (CONFIDENCE_RANK[estimate.confidenceLevel] ?? 0) < (CONFIDENCE_RANK[worst] ?? 0)
        ? estimate.confidenceLevel
        : worst,
    "HIGH"
  );
}

/**
 * Gross modelled monetary envelope: the sum of every owned loss component at
 * full value.  This is a reporting envelope (not a probability-weighted loss)
 * and replaces the old likelihood-multiplier "exposure" figure.
 */
export function grossFinancialExposure(context: RiskCalculationContext): number {
  return context.assets.reduce(
    (sum, asset) =>
      sum +
      Object.values(severityComponentAmounts(asset)).reduce((componentSum, amount) => componentSum + amount, 0),
    0
  );
}

/** Enterprise control effectiveness: unweighted mean across in-scope assets. */
export function enterpriseControlEffectiveness(context: RiskCalculationContext): number {
  if (context.assets.length === 0) return 0;
  return (
    context.assets.reduce((sum, asset) => sum + asset.controlEffectiveness, 0) /
    context.assets.length
  );
}

/**
 * First-order score contribution of an EAL delta.
 *
 * S_E is linear in EAL below the appetite cap, so dScore = w_E x 100 x
 * dEAL / appetite.  Clamped to the 0-100 index.  This is a local (marginal)
 * attribution, disclosed as such — the non-linear likelihood/controls terms are
 * not reassigned to drivers.
 */
export function scoreContributionFromEal(
  ealContribution: number,
  context: RiskCalculationContext
): number {
  const { ealAppetiteInr, riskScoreWeights } = context.parameters;
  const raw = riskScoreWeights.financial * 100 * (ealContribution / ealAppetiteInr);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Frequency stage: likelihood probability -> annualised Poisson rate.
 *
 * The provider reports a horizon probability; converting it back to a rate is
 * what makes the frequency model an explicit, auditable stage rather than an
 * implicit carry-through of the signal score.
 */
export function buildModelledEventClasses(
  context: RiskCalculationContext,
  signals: EnterpriseEventSignal[],
  estimates: LikelihoodEstimate[]
): ModelledEventClass[] {
  const analytic = analyticEnterpriseLoss(context.assets, context.dependencies, context.parameters);
  const analyticByClass = new Map(analytic.byEventClass.map((entry) => [entry.eventClass, entry]));

  return signals.map((signal, index) => {
    const likelihood = estimates[index];
    const frequency = probabilityToAnnualFrequency(
      likelihood.probability,
      context.parameters.horizonDays,
      context.parameters.nearCertainProbabilityCap
    );

    return {
      eventClass: signal.eventClass,
      rawSignal: signal.rawSignal,
      adjustedSignal: signal.adjustedSignal,
      likelihood,
      annualFrequency: frequency.lambda,
      horizonProbability: likelihood.probability,
      cappedProbability: frequency.capped,
      boundaryPolicy: frequency.boundaryPolicy,
      expectedAnnualLoss: analyticByClass.get(signal.eventClass)?.expectedLoss ?? 0,
      modelledAssets: signal.assetContributions.filter((c) => c.adjustedSignal > 0).length,
    };
  });
}

/**
 * Severity stage: one severity scale per (asset, event class) pair that carries
 * signal, with the asset's blast-radius multiplier applied exactly once.
 */
export function buildEventClassModels(
  context: RiskCalculationContext,
  signals: EnterpriseEventSignal[],
  modelled: ModelledEventClass[]
): EventClassModel[] {
  const blastRadius = computeBlastRadiusMap(
    context.assets.map((asset) => asset.assetId),
    context.dependencies,
    context.parameters
  );
  const assetById = new Map(context.assets.map((asset) => [asset.assetId, asset]));

  return modelled.map((entry, index) => {
    const signal = signals[index];
    const severityScales: SeverityScale[] = [];

    for (const contribution of signal.assetContributions) {
      if (contribution.adjustedSignal <= 0) continue;
      const asset = assetById.get(contribution.assetId);
      if (!asset) continue;

      severityScales.push(
        composeSeverityScale(
          asset,
          signal.eventClass,
          context.parameters,
          blastRadius.get(contribution.assetId)?.multiplier ?? 1
        )
      );
    }

    return {
      eventClass: signal.eventClass,
      annualFrequency: entry.annualFrequency,
      severityScales,
    };
  });
}

export interface RiskEngineResult extends RiskCalculationResult {
  /** Per-stage audit trail: signal -> likelihood -> frequency -> loss. */
  modelledEventClasses: ModelledEventClass[];
}

/**
 * Run the full v2 calculation.  Deterministic for a given context: identical
 * inputs, versions and seed always produce an identical `resultHash`.
 */
export async function calculateRisk(
  context: RiskCalculationContext
): Promise<RiskEngineResult> {
  const warnings: string[] = [];

  // ── Stage 1: evidence signals ─────────────────────────────────────────────
  const signals = aggregateEnterpriseSignals(context.assets, context.parameters);

  // ── Stage 2: likelihood (versioned provider — swap point for future ML) ───
  const estimates: LikelihoodEstimate[] = [];
  for (const signal of signals) {
    estimates.push(
      await deterministicLikelihoodProvider.estimate({
        eventClass: signal.eventClass,
        annualRate: signal.adjustedSignal,
        evidenceRefs: Array.from(
          new Set(signal.assetContributions.flatMap((contribution) => contribution.evidenceRefs))
        ),
        parameters: context.parameters,
      })
    );
  }

  // ── Stage 3 + 4: frequency and severity ───────────────────────────────────
  const modelled = buildModelledEventClasses(context, signals, estimates);
  const models = buildEventClassModels(context, signals, modelled);

  // ── Stage 5: Monte Carlo aggregate annual loss ────────────────────────────
  const loss = simulateAggregateAnnualLoss(
    models,
    context.simulation,
    createSeededRandom(context.simulation.seed)
  );

  const eal = loss.summary.mean;
  const var95 = loss.summary.q95;
  const var99 = loss.summary.q99;

  const controlEffectiveness = enterpriseControlEffectiveness(context);
  const financialExposure = grossFinancialExposure(context);

  const score = calculateRiskScore({
    eal,
    annualProbabilities: estimates.map((estimate) => estimate.probability),
    controlEffectiveness,
    parameters: context.parameters,
  });
  warnings.push(...score.warnings);

  const drivers: RiskDriver[] = attributeDrivers({
    assets: context.assets,
    dependencies: context.dependencies,
    parameters: context.parameters,
    baselineEal: eal,
    baselineVar95: var95,
  });

  for (const driver of drivers) {
    driver.contributionToScore = scoreContributionFromEal(driver.contributionToEal ?? 0, context);
  }

  // ── Uncertainty disclosure ────────────────────────────────────────────────
  for (const entry of modelled) {
    if (entry.cappedProbability) {
      warnings.push(`Probability boundary applied to ${entry.eventClass}: ${entry.boundaryPolicy}`);
    }
  }

  const oodClasses = modelled
    .filter((entry) => entry.likelihood.ood)
    .map((entry) => entry.eventClass);
  if (oodClasses.length > 0) {
    warnings.push(`Annual rate outside the calibrated range for: ${oodClasses.join(", ")}`);
  }

  const unmodelled = modelled
    .filter((entry) => entry.modelledAssets === 0)
    .map((entry) => entry.eventClass);
  if (unmodelled.length > 0) {
    warnings.push(`No loss-bearing asset carried signal for: ${unmodelled.join(", ")}`);
  }

  if (context.simulation.developmentGrade) {
    warnings.push(
      `Development-grade simulation: ${context.simulation.simulationCount} runs is below the ` +
        `${PRODUCTION_MIN_SIMULATIONS} production reference minimum.`
    );
  }

  const confidenceLevel = aggregateConfidence(estimates);
  if (confidenceLevel === "INSUFFICIENT") {
    warnings.push("At least one event class is supported by insufficient evidence.");
  }

  const coverage: Record<string, number> = {
    assetCount: context.assets.length,
    assetsWithVulnerabilities: context.assets.filter((asset) => asset.vulnerabilities.length > 0).length,
    assetsWithControls: context.assets.filter((asset) => asset.controls.length > 0).length,
    assetsWithTelemetry: context.assets.filter((asset) => asset.telemetry.length > 0).length,
    internetExposedAssets: context.assets.filter((asset) => asset.internetExposed).length,
    dependencyCount: context.dependencies.length,
    eventClassesModelled: modelled.filter((entry) => entry.modelledAssets > 0).length,
    evidenceRefCount: new Set(
      estimates.flatMap((estimate) => estimate.attribution ? Object.keys(estimate.attribution) : [])
    ).size,
  };

  const frequencySummary = {
    byEventClass: modelled.map((entry) => ({
      eventClass: entry.eventClass,
      annualFrequency: entry.annualFrequency,
      horizonProbability: entry.horizonProbability,
      expectedAnnualLoss: entry.expectedAnnualLoss,
      cappedProbability: entry.cappedProbability,
    })),
  };

  const versions = {
    riskEngine: RISK_ENGINE_VERSION_V2,
    parameters: context.parameters.parameterVersion,
    modelBundle: context.modelBundle.modelBundleVersion,
    score: context.parameters.riskScoreVersion,
    simulation: context.simulation.configVersion,
  };

  const simulationBlock = {
    simulationCount: context.simulation.simulationCount,
    seed: context.simulation.seed,
    samplingMethod: context.simulation.samplingMethod,
    quantileMethod: context.simulation.quantileMethod,
    developmentGrade: context.simulation.developmentGrade,
  };

  const lossDistributionSummary = {
    simulationCount: loss.summary.simulationCount,
    mean: loss.summary.mean,
    median: loss.summary.median,
    q90: loss.summary.q90,
    q95: loss.summary.q95,
    q99: loss.summary.q99,
    maxSimulated: loss.summary.maxSimulated,
  };

  const resultBody: Omit<RiskEngineResult, "resultHash" | "modelledEventClasses"> = {
    eal,
    var95,
    var99,
    financialExposure,
    riskScore: score.riskScore,
    riskScoreComponents: score.components,
    lossDistributionSummary,
    frequencySummary,
    controlEffectiveness,
    drivers,
    uncertainty: {
      confidenceLevel,
      coverage,
      warnings,
      ood: oodClasses.length > 0,
    },
    versions,
    simulation: simulationBlock,
    inputStateHash: context.inputStateHash,
  };

  // The hash covers everything reproducible about this number set — never a
  // timestamp — so re-running the same context reproduces the same fingerprint.
  const resultHash = hashRiskResult(canonicalResultPayload(resultBody));

  return {
    ...resultBody,
    resultHash,
    modelledEventClasses: modelled,
  };
}

/**
 * The field set that defines a result's identity.
 *
 * Exposed so the persistence layer can hash the *same* payload the engine
 * hashed — RiskRun.resultHash and RiskCalculationResult.resultHash are then
 * the same fingerprint by construction, not by coincidence.
 */
export function canonicalResultPayload(
  result: Omit<RiskCalculationResult, "resultHash">
): Record<string, unknown> {
  return {
    eal: result.eal,
    var95: result.var95,
    var99: result.var99,
    financialExposure: result.financialExposure,
    riskScore: result.riskScore,
    riskScoreComponents: result.riskScoreComponents,
    lossDistributionSummary: result.lossDistributionSummary,
    frequencySummary: result.frequencySummary,
    controlEffectiveness: result.controlEffectiveness,
    drivers: result.drivers,
    versions: result.versions,
    simulation: result.simulation,
    inputStateHash: result.inputStateHash,
  };
}

