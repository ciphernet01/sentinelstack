/**
 * P4 — Scenario cost semantics and investment outcome
 *
 * A scenario is only decision-useful alongside what it costs. This module
 * normalises cost inputs and produces the outcome shape P5 consumes.
 *
 * Two rules from the spec that shape the whole design:
 *
 *   §35 — one-time and recurring cost must NOT be collapsed into one ambiguous
 *         figure. A ₹1M licence and a ₹1M/yr managed service are different
 *         decisions, and a single "cost" field destroys that.
 *
 *   §37 — ROSI is a *generic* economic derivation. P4 owns the inputs
 *         (state, risk outcome, cost); P5 owns portfolio optimisation and the
 *         final investment verdict. Organisation-specific ROSI conventions must
 *         be versioned, so the convention is recorded with the figure rather
 *         than assumed.
 */

import type { ScenarioResult } from "./scenarioRunner.service";

export const ROSI_CONVENTION = "rosi-v1";

/** Cost basis: what the money is for. */
export type CostSemantics =
  | "CAPEX"
  | "OPEX"
  | "ONE_TIME"
  | "ANNUAL"
  | "MONTHLY"
  | "LICENSE"
  | "IMPLEMENTATION"
  | "PERSONNEL"
  | "SERVICE_PROVIDER";

/** Where the number came from. Provenance for a figure that drives spending. */
export type CostBasis =
  | "INVESTMENT_OPTION"
  | "IMPLEMENTATION_ESTIMATE"
  | "USER_ASSUMPTION"
  | "APPROVED_CATALOG";

export interface ScenarioCostInput {
  /** One-time capital/implementation spend. */
  oneTime?: number;
  /** Annual recurring spend. */
  annual?: number;
  currency: string;
  semantics: CostSemantics[];
  basis: CostBasis;
  /** Free-text provenance, e.g. a quote reference. */
  sourceReference?: string;
}

export interface NormalisedCost {
  oneTime: number;
  annual: number;
  currency: string;
  semantics: CostSemantics[];
  basis: CostBasis;
  sourceReference: string | null;
  /**
   * A single comparable figure, used only for ordering scenarios that share a
   * horizon. It is an annualised blend, never presented as "the cost".
   */
  annualised: number;
  /** True when the input declared only one of the two components. */
  isPartial: boolean;
  warnings: string[];
}

export class ScenarioCostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioCostError";
  }
}

const MONTHS_PER_YEAR = 12;

/**
 * Normalise a cost input into a shape P5 can consume.
 *
 * `annualised` blends one-time spend over a horizon. The default horizon is
 * three years, and it is recorded in the warnings so a reader knows the blend
 * was applied rather than assumed silently.
 */
export function normaliseScenarioCost(
  input: ScenarioCostInput,
  options: { horizonYears?: number } = {}
): NormalisedCost {
  const horizonYears = options.horizonYears ?? 3;
  const warnings: string[] = [];

  if (!Number.isFinite(horizonYears) || horizonYears <= 0) {
    throw new ScenarioCostError("horizonYears must be a positive number");
  }

  const oneTime = input.oneTime ?? 0;
  const annual = input.annual ?? 0;

  if (!Number.isFinite(oneTime) || oneTime < 0) {
    throw new ScenarioCostError("oneTime cost must be a non-negative number");
  }
  if (!Number.isFinite(annual) || annual < 0) {
    throw new ScenarioCostError("annual cost must be a non-negative number");
  }
  if (oneTime === 0 && annual === 0) {
    throw new ScenarioCostError("a scenario must declare a cost of some kind");
  }
  if (input.semantics.length === 0) {
    throw new ScenarioCostError("at least one cost semantic is required");
  }

  const isPartial = (input.oneTime === undefined) !== (input.annual === undefined);
  if (isPartial) {
    warnings.push(
      "Only one cost component was declared. The missing component is treated as zero, " +
        "not as unknown — check this is intended before relying on any ratio."
    );
  }

  const annualised = annual + oneTime / horizonYears;
  warnings.push(
    `One-time cost was annualised over ${horizonYears} years for comparison purposes only. ` +
      `It is not a recurring commitment.`
  );

  return {
    oneTime,
    annual,
    currency: input.currency,
    semantics: [...input.semantics],
    basis: input.basis,
    sourceReference: input.sourceReference ?? null,
    annualised,
    isPartial,
    warnings,
  };
}

/** The outcome P5 consumes as a direct optimization input (spec §75). */
export interface InvestmentScenarioOutcome {
  investmentOptionId: string | null;
  scenarioId: string;
  cost: {
    oneTime: number;
    annual: number;
    annualised: number;
    currency: string;
  };
  baselineEal: number;
  scenarioEal: number;
  avoidedEal: number;
  baselineVar95: number;
  scenarioVar95: number;
  baselineRiskScore: number;
  scenarioRiskScore: number;
  residualRisk: number;
  assumptions: string[];
  rosi: RosiSummary | null;
}

export interface RosiSummary {
  convention: string;
  grossBenefit: number;
  cost: number;
  netBenefit: number;
  /** Percentage. Null when the cost is zero, because the ratio is undefined. */
  value: number | null;
  currency: string;
  /** Stated so a negative or huge figure is not read as a real return. */
  interpretation: string;
}

/**
 * Return on Security Investment.
 *
 *   GrossBenefit = avoided EAL
 *   NetBenefit   = avoided EAL - cost
 *   ROSI         = (NetBenefit / Cost) x 100
 *
 * The avoided EAL is a *modelled* reduction in expected loss, not a realised
 * saving or a profit, and the `interpretation` string says so on every figure.
 * A zero cost yields a null ratio rather than Infinity, because "infinitely
 * good" is not a decision anyone can act on.
 */
export function calculateRosi(input: {
  avoidedEal: number;
  cost: number;
  currency: string;
  convention?: string;
}): RosiSummary {
  const { avoidedEal, cost, currency } = input;
  const convention = input.convention ?? ROSI_CONVENTION;

  if (!Number.isFinite(avoidedEal)) {
    throw new ScenarioCostError("avoidedEal must be a finite number");
  }
  if (!Number.isFinite(cost) || cost < 0) {
    throw new ScenarioCostError("cost must be a non-negative number");
  }

  const netBenefit = avoidedEal - cost;
  const value = cost > 0 ? (netBenefit / cost) * 100 : null;

  return {
    convention,
    grossBenefit: avoidedEal,
    cost,
    netBenefit,
    value,
    currency,
    interpretation:
      "Modelled return on a modelled reduction in expected annual loss. The benefit is " +
      "an estimate under stated scenario assumptions, not a realised saving or a " +
      "financial return, and excludes residual risk, implementation risk and the cost " +
      "of controls not modelled in this scenario.",
  };
}

/**
 * Build the P5 optimization input from a scenario result and its cost.
 *
 * Assumptions are collected from the scenario's own warnings and uncertainty
 * block, so the consumer always sees what the figure was conditioned on.
 */
export function buildInvestmentOutcome(input: {
  scenarioId: string;
  result: ScenarioResult;
  cost: NormalisedCost;
  investmentOptionId?: string;
}): InvestmentScenarioOutcome {
  const { result, cost } = input;

  const assumptions: string[] = [
    `Risk reduction measured against baseline result ${result.baselineResultHash.slice(0, 19)}...`,
    `Scenario state ${result.scenarioStateHash.slice(0, 19)}...`,
    `Engine ${result.versions.riskEngine}, parameters ${result.versions.parameters}, model ${result.versions.modelBundle}`,
    ...(cost.isPartial ? ["Cost input declared only one of one-time / annual."] : []),
  ];

  if (result.uncertainty.confidenceLevel !== "HIGH") {
    assumptions.push(
      `Model confidence is ${result.uncertainty.confidenceLevel}; treat the reduction as indicative.`
    );
  }
  assumptions.push(...result.warnings);

  return {
    investmentOptionId: input.investmentOptionId ?? null,
    scenarioId: input.scenarioId,
    cost: {
      oneTime: cost.oneTime,
      annual: cost.annual,
      annualised: cost.annualised,
      currency: cost.currency,
    },
    baselineEal: result.baseline.eal,
    scenarioEal: result.scenario.eal,
    avoidedEal: result.riskReduction.eal,
    baselineVar95: result.baseline.var95,
    scenarioVar95: result.scenario.var95,
    baselineRiskScore: result.baseline.riskScore,
    scenarioRiskScore: result.scenario.riskScore,
    residualRisk: result.residualRisk.eal,
    assumptions,
    // Only meaningful once a cost exists; a what-if with no cost has no ratio.
    rosi:
      cost.oneTime + cost.annual > 0
        ? calculateRosi({
            avoidedEal: result.riskReduction.eal,
            cost: cost.annualised,
            currency: cost.currency,
          })
        : null,
  };
}

/**
 * Build the investment-risk reduction curve (§79).
 *
 * x = cost, y = avoided EAL. This is a visualisation input, explicitly NOT an
 * optimisation verdict — P5 decides.
 */
export interface ReductionCurvePoint {
  scenarioId: string;
  cost: number;
  avoidedEal: number;
  residualRisk: number;
  currency: string;
}

export function buildReductionCurve(
  outcomes: Array<{ scenarioId: string; outcome: InvestmentScenarioOutcome }>
): ReductionCurvePoint[] {
  return outcomes
    .map(({ scenarioId, outcome }) => ({
      scenarioId,
      cost: outcome.cost.annualised,
      avoidedEal: outcome.avoidedEal,
      residualRisk: outcome.residualRisk,
      currency: outcome.cost.currency,
    }))
    // Ordered by cost so the curve is directly plottable.
    .sort((a, b) => a.cost - b.cost);
}

/**
 * Order scenarios by modelled benefit per unit of annualised cost (§79).
 *
 * Scenarios with no cost are excluded rather than sorted as infinitely good:
 * an unpriced what-if cannot be ranked against a priced one.
 */
export function rankByBenefitPerCost(
  outcomes: Array<{ scenarioId: string; outcome: InvestmentScenarioOutcome }>
): Array<{ scenarioId: string; cost: number; avoidedEal: number; ratio: number }> {
  return outcomes
    .filter(({ outcome }) => outcome.cost.annualised > 0)
    .map(({ scenarioId, outcome }) => ({
      scenarioId,
      cost: outcome.cost.annualised,
      avoidedEal: outcome.avoidedEal,
      ratio: outcome.avoidedEal / outcome.cost.annualised,
    }))
    .sort((a, b) => b.ratio - a.ratio);
}