/**
 * P4 — Scenario runner
 *
 * Runs a what-if: resolve the scenario state, calculate it with the *same* P2
 * engine used for the baseline, and report the difference.
 *
 * There is no scenario-specific financial formula anywhere in this file. The
 * deltas are plain subtraction between two results produced by identical
 * mathematics; that is the whole point (spec §5.3, §18, §31).
 */

import { calculateRisk, type RiskEngineResult } from "../risk/riskEngine.service";
import type { RiskCalculationContext } from "../risk/riskCalculationContext";
import {
  resolveScenarioState,
  type ResolvedScenarioState,
  type ScenarioChange,
  type ScenarioChangeType,
  type ScenarioValidationIssue,
} from "./scenarioState.service";

export const SCENARIO_RESULT_VERSION = "scenario-result-v1";

/** Monetary figures share one currency; the score is a unitless index. */
export interface ScenarioMetrics {
  eal: number;
  var95: number;
  var99: number;
  financialExposure: number;
  riskScore: number;
}

export interface ScenarioResult {
  version: string;
  type: ScenarioChangeType;
  baseline: ScenarioMetrics;
  scenario: ScenarioMetrics;
  /** Signed: scenario - baseline. A negative number means risk went down. */
  delta: ScenarioMetrics;
  /** Explicitly named: baseline - scenario. Never negative for a well-formed run. */
  riskReduction: ScenarioMetrics;
  /**
   * Risk that remains after the change, not "savings". Avoided EAL is a modelled
   * reduction, not profit or a guaranteed saving (spec §34).
   */
  residualRisk: { eal: number; var95: number; riskScore: number };
  cost: number | null;
  avoidedEal: number | null;
  scenarioStateHash: string;
  baselineResultHash: string;
  scenarioResultHash: string;
  appliedChanges: ScenarioChange[];
  validationIssues: ScenarioValidationIssue[];
  warnings: string[];
  uncertainty: RiskEngineResult["uncertainty"];
  versions: RiskEngineResult["versions"];
  simulation: RiskEngineResult["simulation"];
}

export interface RunScenarioInput {
  type: ScenarioChangeType;
  baselineContext: RiskCalculationContext;
  baselineResult: RiskEngineResult;
  changes: ScenarioChange[];
  /** Implementation cost from an investment option or a user assumption. */
  cost?: number;
  /** Abort rather than run a partially applied scenario. */
  strict?: boolean;
}

/** Extract the comparable metric set from an engine result. */
export function extractMetrics(result: RiskEngineResult): ScenarioMetrics {
  return {
    eal: result.eal,
    var95: result.var95,
    var99: result.var99,
    financialExposure: result.financialExposure,
    riskScore: result.riskScore,
  };
}

/**
 * Signed delta (scenario - baseline) and named reduction (baseline - scenario).
 *
 * Kept as two separate fields on purpose (spec §33): "risk went down by ₹3M" and
 * "risk changed by -₹3M" are the same number but mean different things to a
 * reader, and collapsing them loses the direction.
 */
export function computeDeltas(
  baseline: ScenarioMetrics,
  scenario: ScenarioMetrics
): { delta: ScenarioMetrics; riskReduction: ScenarioMetrics } {
  const delta: ScenarioMetrics = {
    eal: scenario.eal - baseline.eal,
    var95: scenario.var95 - baseline.var95,
    var99: scenario.var99 - baseline.var99,
    financialExposure: scenario.financialExposure - baseline.financialExposure,
    riskScore: scenario.riskScore - baseline.riskScore,
  };

  const riskReduction: ScenarioMetrics = {
    eal: baseline.eal - scenario.eal,
    var95: baseline.var95 - scenario.var95,
    var99: baseline.var99 - scenario.var99,
    financialExposure: baseline.financialExposure - scenario.financialExposure,
    riskScore: baseline.riskScore - scenario.riskScore,
  };

  return { delta, riskReduction };
}

/**
 * Assemble a scenario result from two already-computed engine results.
 *
 * Split out so a caller that needs the scenario's engine result for something
 * else (P3 attribution, for instance) can calculate once and reuse it, rather
 * than paying for a second Monte Carlo pass.
 */
export function buildScenarioResult(input: {
  type: ScenarioChangeType;
  baselineResult: RiskEngineResult;
  scenarioResult: RiskEngineResult;
  scenarioStateHash: string;
  appliedChanges: ScenarioChange[];
  validationIssues: ScenarioValidationIssue[];
  warnings: string[];
  cost?: number;
}): ScenarioResult {
  const baseline = extractMetrics(input.baselineResult);
  const scenario = extractMetrics(input.scenarioResult);
  const { delta, riskReduction } = computeDeltas(baseline, scenario);

  return {
    version: SCENARIO_RESULT_VERSION,
    type: input.type,
    baseline,
    scenario,
    delta,
    riskReduction,
    residualRisk: {
      // Residual is the post-change figure, not the reduction.
      eal: scenario.eal,
      var95: scenario.var95,
      riskScore: scenario.riskScore,
    },
    cost: input.cost ?? null,
    avoidedEal: riskReduction.eal,
    scenarioStateHash: input.scenarioStateHash,
    baselineResultHash: input.baselineResult.resultHash,
    scenarioResultHash: input.scenarioResult.resultHash,
    appliedChanges: input.appliedChanges,
    validationIssues: input.validationIssues,
    warnings: [...input.warnings, ...input.scenarioResult.uncertainty.warnings],
    uncertainty: input.scenarioResult.uncertainty,
    versions: input.scenarioResult.versions,
    simulation: input.scenarioResult.simulation,
  };
}

export class ScenarioNotApplicableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioNotApplicableError";
  }
}

/**
 * Run a scenario.
 *
 * `strict` (the default for API callers) refuses to run when any declared change
 * failed validation. A partially applied scenario is dangerous: the delta it
 * produces would describe a scenario the analyst did not ask for.
 */
export async function runScenario(input: RunScenarioInput): Promise<ScenarioResult> {
  const { baselineContext, baselineResult, changes, type, cost } = input;
  const strict = input.strict ?? true;

  const resolved: ResolvedScenarioState = resolveScenarioState(baselineContext, changes);

  if (resolved.issues.length > 0 && strict) {
    const detail = resolved.issues
      .map((issue) => `${issue.changeId}: ${issue.message}`)
      .join("; ");
    throw new ScenarioNotApplicableError(`Scenario cannot be applied: ${detail}`);
  }

  // At this point either strict validation passed, or the caller explicitly
  // accepted a partial application. Either way the only remaining blocker is
  // having applied nothing at all — gating on `issues.length` here would make
  // non-strict mode unreachable.
  if (resolved.applied.length === 0) {
    throw new ScenarioNotApplicableError(
      "Scenario declares no applicable changes; there is nothing to calculate."
    );
  }

  // Same engine, same parameters, same simulation config, same seed policy.
  // Only the input state differs.
  const scenarioResult = await calculateRisk(resolved.context);

  return buildScenarioResult({
    type,
    baselineResult,
    scenarioResult,
    scenarioStateHash: resolved.scenarioStateHash,
    appliedChanges: resolved.applied,
    validationIssues: resolved.issues,
    warnings: resolved.warnings,
    ...(cost === undefined ? {} : { cost }),
  });
}