/**
 * P2 — Likelihood Provider
 *
 * The Risk Engine must not hardcode a single likelihood algorithm.  P2 ships a
 * versioned deterministic/statistical baseline provider behind the same
 * `LikelihoodProvider` interface a future calibrated ML provider will use.
 *
 * Conversion used by the baseline provider:
 *
 *   raw annual rate  ->  horizon probability
 *        p_h = 1 - exp(-rate x H_y)
 *
 * which is exactly the inverse of the frequency transformation in
 * `frequency.service.ts`, so the pipeline round-trips consistently.
 */

import type { RiskParameterBundle } from "./assumptions.service";
import type { EnterpriseEventSignal, EventClass } from "./evidenceSignals.service";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface LikelihoodInput {
  eventClass: EventClass;
  /** Aggregate annual rate (expected events per year) for this event class. */
  annualRate: number;
  /** Distinct evidence references backing this estimate. */
  evidenceRefs: string[];
  parameters: RiskParameterBundle;
}

export interface LikelihoodEstimate {
  eventClass: string;
  horizonDays: number;
  probability: number;
  confidenceLevel: ConfidenceLevel;
  modelVersion: string;
  featureSetVersion?: string;
  /** True when the input rate is far outside the calibrated range. */
  ood: boolean;
  /** Per-source share of the rate, for explainability. */
  attribution?: Record<string, number>;
}

export interface LikelihoodProvider {
  readonly version: string;
  estimate(input: LikelihoodInput): Promise<LikelihoodEstimate>;
}

/**
 * Out-of-distribution guard.
 *
 * The deterministic baseline is calibrated for expected annual rates below one
 * event per year per class.  Above this threshold the estimate is still
 * produced but flagged `ood` so the assessment can disclose that the input is
 * outside the calibrated range rather than silently trusting it.
 */
export const OOD_ANNUAL_RATE_THRESHOLD = 1;

/** Convert a raw annual rate into a horizon probability (saturating). */
export function probabilityFromAnnualRate(annualRate: number, horizonDays: number): number {
  if (!(annualRate > 0)) return 0;
  const horizonYears = horizonDays / 365;
  const expectedInHorizon = annualRate * horizonYears;
  // 1 - exp(-x) is numerically stable and always within [0, 1).
  return -Math.expm1(-expectedInHorizon);
}

export function confidenceFromEvidence(evidenceRefCount: number): ConfidenceLevel {
  if (evidenceRefCount >= 5) return "HIGH";
  if (evidenceRefCount >= 2) return "MEDIUM";
  if (evidenceRefCount >= 1) return "LOW";
  return "INSUFFICIENT";
}

/**
 * Deterministic baseline likelihood provider.
 *
 * Versioned so that promoting a calibrated ML provider later is an explicit,
 * auditable change rather than an invisible swap.
 */
export class DeterministicLikelihoodProvider implements LikelihoodProvider {
  readonly version = "deterministic-likelihood-v2";

  async estimate(input: LikelihoodInput): Promise<LikelihoodEstimate> {
    const horizonDays = input.parameters.horizonDays;
    const probability = probabilityFromAnnualRate(input.annualRate, horizonDays);
    const evidenceRefCount = new Set(input.evidenceRefs.filter(Boolean)).size;

    return {
      eventClass: input.eventClass,
      horizonDays,
      probability,
      confidenceLevel: confidenceFromEvidence(evidenceRefCount),
      modelVersion: this.version,
      featureSetVersion: "features-v1",
      ood: input.annualRate > OOD_ANNUAL_RATE_THRESHOLD,
    };
  }
}

export const deterministicLikelihoodProvider = new DeterministicLikelihoodProvider();

/** Estimate every event class for the enterprise in one pass. */
export async function estimateAllEventClasses(
  signals: EnterpriseEventSignal[],
  parameters: RiskParameterBundle,
  provider: LikelihoodProvider = deterministicLikelihoodProvider
): Promise<Map<EventClass, LikelihoodEstimate>> {
  const estimates = new Map<EventClass, LikelihoodEstimate>();

  for (const signal of signals) {
    const evidenceRefs = signal.assetContributions.flatMap((c) => c.evidenceRefs);
    estimates.set(
      signal.eventClass,
      await provider.estimate({
        eventClass: signal.eventClass,
        annualRate: signal.adjustedSignal,
        evidenceRefs,
        parameters,
      })
    );
  }

  return estimates;
}
