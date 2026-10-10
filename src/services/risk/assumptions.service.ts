/**
 * P2 — Assumptions / Parameter Bundle
 *
 * Approved financial and risk parameters, loaded from one governed place
 * instead of being embedded as literals across the engine.
 *
 * Every parameter carries an explicit version string so a historical
 * assessment can always be reconstructed from the exact assumptions used.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskScoreWeights {
  financial: number;
  likelihood: number;
  controls: number;
}

export interface RiskParameterBundle {
  /** Reporting currency for all monetary parameters. */
  currency: string;
  parameterVersion: string;

  /** Enterprise risk appetite used by the financial component of the score. */
  ealAppetiteInr: number;

  /** Product Risk Score weights. Must sum to 1. */
  riskScoreWeights: RiskScoreWeights;
  riskScoreVersion: string;

  /** Maximum fraction of likelihood that controls are modelled to remove. */
  maxControlLikelihoodReduction: number;

  /** Likelihood horizon in days. 365 => p_h is already an annual probability. */
  horizonDays: number;

  /** Lognormal shape (sigma) per event class — controls severity dispersion. */
  severitySigmaByEventClass: Record<string, number>;

  /** Normalized dependency strength per dependency type (0..1). */
  dependencyStrengthByType: Record<string, number>;

  /** Hard cap on blast-radius amplification so dependencies cannot explode loss. */
  dependencyAmplificationCap: number;

  /**
   * Numerical safety rule for near-certain probabilities. The policy is
   * recorded with the result rather than silently applied.
   */
  nearCertainProbabilityCap: number;
}

export interface RiskModelBundle {
  modelBundleVersion: string;
  likelihoodProviderVersion: string;
  severityFamily: "LOGNORMAL";
  frequencyModel: "POISSON";
  eventClassTaxonomyVersion: string;
  driverAttributionMethod: "COUNTERFACTUAL_V1";
}

// ---------------------------------------------------------------------------
// Defaults (deterministic-baseline-v0 assumptions)
// ---------------------------------------------------------------------------

export const DEFAULT_RISK_PARAMETERS: RiskParameterBundle = Object.freeze({
  currency: "INR",
  parameterVersion: "params-2026-09",
  ealAppetiteInr: 10_000_000,
  riskScoreWeights: { financial: 0.5, likelihood: 0.3, controls: 0.2 },
  riskScoreVersion: "risk-score-v1",
  maxControlLikelihoodReduction: 0.55,
  horizonDays: 365,
  severitySigmaByEventClass: {
    EXTERNAL_EXPLOITATION: 1.1,
    CREDENTIAL_COMPROMISE: 0.9,
    RANSOMWARE: 1.3,
    CLOUD_COMPROMISE: 1.0,
    DATA_EXPOSURE: 1.2,
    PRIVILEGE_ESCALATION: 0.9,
    THIRD_PARTY: 1.0,
    AVAILABILITY_ATTACK: 0.8,
  },
  dependencyStrengthByType: {
    DATA: 0.6,
    SERVICE: 0.5,
    AUTH: 0.7,
    NETWORK: 0.4,
    PHYSICAL: 0.3,
    THIRD_PARTY: 0.5,
  },
  dependencyAmplificationCap: 1.75,
  nearCertainProbabilityCap: 0.999_999,
});

export const DEFAULT_MODEL_BUNDLE: RiskModelBundle = Object.freeze({
  modelBundleVersion: "risk-engine-v2.0",
  likelihoodProviderVersion: "deterministic-likelihood-v2",
  severityFamily: "LOGNORMAL",
  frequencyModel: "POISSON",
  eventClassTaxonomyVersion: "event-classes-v1",
  driverAttributionMethod: "COUNTERFACTUAL_V1",
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildRiskParameters(
  overrides: Partial<RiskParameterBundle> = {}
): RiskParameterBundle {
  const merged: RiskParameterBundle = {
    ...DEFAULT_RISK_PARAMETERS,
    ...overrides,
    riskScoreWeights: {
      ...DEFAULT_RISK_PARAMETERS.riskScoreWeights,
      ...(overrides.riskScoreWeights ?? {}),
    },
    severitySigmaByEventClass: {
      ...DEFAULT_RISK_PARAMETERS.severitySigmaByEventClass,
      ...(overrides.severitySigmaByEventClass ?? {}),
    },
    dependencyStrengthByType: {
      ...DEFAULT_RISK_PARAMETERS.dependencyStrengthByType,
      ...(overrides.dependencyStrengthByType ?? {}),
    },
  };

  const { financial, likelihood, controls } = merged.riskScoreWeights;
  const total = financial + likelihood + controls;
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`risk score weights must sum to 1 (received ${total})`);
  }
  if (merged.ealAppetiteInr <= 0) {
    throw new Error("ealAppetiteInr must be greater than zero");
  }

  return Object.freeze(merged);
}

export function buildModelBundle(
  overrides: Partial<RiskModelBundle> = {}
): RiskModelBundle {
  return Object.freeze({ ...DEFAULT_MODEL_BUNDLE, ...overrides });
}
