/**
 * P2 — Product Risk Score
 *
 * SentinelStack's own 0-100 risk index. It is NOT a regulatory score.
 *
 *   S_E = 100 x clamp(EAL / EAL_appetite, 0, 1)
 *   S_L = 100 x max annual class probability
 *   S_C = 100 x (1 - CE_enterprise)
 *
 *   RiskScore = w_E x S_E + w_L x S_L + w_C x S_C     (weights sum to 1)
 *
 * Weights and appetite come from the versioned parameter bundle, and the
 * components are persisted alongside the score so it can be reconstructed.
 */

import type { RiskParameterBundle } from "./assumptions.service";
import type { RiskScoreComponents } from "./riskCalculationContext";

export interface RiskScoreInput {
  eal: number;
  /** Annual event probability per modelled event class. */
  annualProbabilities: number[];
  /** Enterprise control effectiveness in [0, 1]. */
  controlEffectiveness: number;
  parameters: RiskParameterBundle;
}

export interface RiskScoreResult {
  riskScore: number;
  riskScoreVersion: string;
  components: RiskScoreComponents;
  /** The exact inputs used, so the score is reconstructable. */
  parameters: {
    ealAppetiteInr: number;
    weights: RiskScoreComponents;
    maxAnnualProbability: number;
    enterpriseControlEffectiveness: number;
  };
  warnings: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  const { eal, annualProbabilities, controlEffectiveness, parameters } = input;
  const warnings: string[] = [];

  if (annualProbabilities.length === 0) {
    warnings.push("No event classes were modelled; likelihood component set to zero.");
  }

  const maxAnnualProbability = annualProbabilities.reduce(
    (max, probability) => Math.max(max, clamp01(probability)),
    0
  );

  const financialSeverity = 100 * clamp01(eal / parameters.ealAppetiteInr);
  const likelihoodSeverity = 100 * maxAnnualProbability;
  const controlSeverity = 100 * (1 - clamp01(controlEffectiveness));

  const components: RiskScoreComponents = {
    financial: financialSeverity,
    likelihood: likelihoodSeverity,
    controls: controlSeverity,
  };

  const weights = parameters.riskScoreWeights;
  const weighted =
    weights.financial * components.financial +
    weights.likelihood * components.likelihood +
    weights.controls * components.controls;

  return {
    riskScore: Math.round(Math.min(100, Math.max(0, weighted))),
    riskScoreVersion: parameters.riskScoreVersion,
    components,
    parameters: {
      ealAppetiteInr: parameters.ealAppetiteInr,
      weights: { ...weights },
      maxAnnualProbability,
      enterpriseControlEffectiveness: clamp01(controlEffectiveness),
    },
    warnings,
  };
}
