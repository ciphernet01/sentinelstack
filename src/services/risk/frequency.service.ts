/**
 * P2 — Frequency Transformation
 *
 * Converts a horizon event probability into an annual Poisson event rate.
 *
 *   H_y = horizonDays / 365
 *   lambda = -ln(1 - p_h) / H_y
 *
 * Boundary handling (P2 spec §9.1):
 *   • p_h = 0  ->  lambda = 0
 *   • p_h = 1  ->  capped by an explicit, recorded numerical safety policy
 *
 * A near-certain probability is never silently capped: the applied policy and
 * whether it was engaged are returned with the frequency so the assessment can
 * disclose it.
 */

export const NEAR_CERTAIN_CAP_POLICY =
  "NEAR_CERTAIN_PROBABILITY_CAPPED_AT_1_MINUS_1E-6";

export interface AnnualFrequencyResult {
  /** Annualized Poisson rate (>= 0). */
  lambda: number;
  /** The probability actually used after boundary handling. */
  effectiveProbability: number;
  /** True when the near-certain cap was engaged. */
  capped: boolean;
  /** Human/audit readable statement of the applied boundary policy. */
  boundaryPolicy: string | null;
  horizonDays: number;
}

const EPSILON = 1e-6;

/**
 * @param probability     probability of at least one event in the horizon (0..1)
 * @param horizonDays     length of the horizon in days (default 365)
 * @param nearCertainCap  safety cap for probabilities approaching 1
 */
export function probabilityToAnnualFrequency(
  probability: number,
  horizonDays = 365,
  nearCertainCap = 1 - EPSILON
): AnnualFrequencyResult {
  if (!Number.isFinite(probability)) {
    throw new Error("probability must be a finite number");
  }
  if (!(horizonDays > 0)) {
    throw new Error("horizonDays must be greater than zero");
  }

  const clampedToRange = Math.min(1, Math.max(0, probability));

  if (clampedToRange === 0) {
    return {
      lambda: 0,
      effectiveProbability: 0,
      capped: false,
      boundaryPolicy: null,
      horizonDays,
    };
  }

  const capped = clampedToRange >= nearCertainCap;
  const effectiveProbability = capped ? nearCertainCap : clampedToRange;
  const horizonYears = horizonDays / 365;

  const lambda = Math.max(0, -Math.log(1 - effectiveProbability) / horizonYears);

  return {
    lambda,
    effectiveProbability,
    capped,
    boundaryPolicy: capped ? NEAR_CERTAIN_CAP_POLICY : null,
    horizonDays,
  };
}

/** Convenience: annual rate for an already-annual probability. */
export function annualFrequencyFromAnnualProbability(probability: number): AnnualFrequencyResult {
  return probabilityToAnnualFrequency(probability, 365);
}

/**
 * Expected annual event count for a Poisson process. Kept explicit so driver
 * attribution can reason in expected values without running a simulation.
 */
export function expectedAnnualEventCount(lambda: number): number {
  return Math.max(0, lambda);
}
