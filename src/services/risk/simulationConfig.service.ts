/**
 * P2 — Simulation Configuration
 *
 * The Monte Carlo configuration is a first-class, versioned input.  It must be
 * persisted with every run so that a result can be reproduced exactly:
 *
 *   same input + same seed + same config + same model bundle
 *     -> equivalent result
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SamplingMethod = "MONTE_CARLO";
export type QuantileMethod = "LINEAR_INTERPOLATION_V1";

export interface SimulationConfig {
  /** Number of simulated annual loss outcomes. */
  simulationCount: number;
  /** Deterministic seed. Required for reproducible development/test results. */
  seed: number;
  samplingMethod: SamplingMethod;
  quantileMethod: QuantileMethod;
  /** True when simulationCount is below the production reference minimum. */
  developmentGrade: boolean;
  configVersion: string;
}

/**
 * Mathematical baseline requires M >= 50,000 for a production-grade reference
 * result.  Development/test runs may use fewer simulations but are then
 * explicitly labelled development-grade.
 */
export const PRODUCTION_MIN_SIMULATIONS = 50_000;

/** Default development-grade configuration. Deterministic and CI-cheap. */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = Object.freeze({
  simulationCount: 10_000,
  seed: 42,
  samplingMethod: "MONTE_CARLO",
  quantileMethod: "LINEAR_INTERPOLATION_V1",
  developmentGrade: true,
  configVersion: "mc-config-v2",
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildSimulationConfig(
  overrides: Partial<SimulationConfig> = {}
): SimulationConfig {
  const merged: SimulationConfig = {
    ...DEFAULT_SIMULATION_CONFIG,
    ...overrides,
  };

  if (!Number.isInteger(merged.simulationCount) || merged.simulationCount < 1) {
    throw new Error("simulationCount must be a positive integer");
  }
  if (!Number.isInteger(merged.seed)) {
    throw new Error("seed must be an integer");
  }

  return Object.freeze({
    ...merged,
    developmentGrade:
      overrides.developmentGrade ?? merged.simulationCount < PRODUCTION_MIN_SIMULATIONS,
  });
}

/** Stable fingerprint of the simulation configuration for the calculation hash. */
export function simulationConfigHash(config: SimulationConfig): string {
  const identity = {
    simulationCount: config.simulationCount,
    seed: config.seed,
    samplingMethod: config.samplingMethod,
    quantileMethod: config.quantileMethod,
    configVersion: config.configVersion,
  };
  const json = JSON.stringify(identity, Object.keys(identity).sort());
  return `sha256:${createHash("sha256").update(json, "utf8").digest("hex")}`;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG
// ---------------------------------------------------------------------------

/**
 * mulberry32 — a small, fast, fully deterministic 32-bit PRNG.
 *
 * Chosen over `Math.random()` because reproducibility is a hard requirement:
 * the same seed must always yield the same loss distribution.
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ---------------------------------------------------------------------------
// Distribution sampling helpers (all driven by an injected RNG)
// ---------------------------------------------------------------------------

export type RandomSource = () => number;

/** Standard normal via Box–Muller. */
export function sampleStandardNormal(random: RandomSource): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Poisson sample via Knuth's algorithm.
 *
 * Annual event rates in cyber risk are small (typically well under 1), so
 * Knuth's O(lambda) method is both exact and fast.  A normal approximation is
 * used as a safety valve if a caller supplies a very large rate.
 */
export function samplePoisson(lambda: number, random: RandomSource): number {
  if (!(lambda > 0)) return 0;

  if (lambda > 30) {
    const approx = lambda + Math.sqrt(lambda) * sampleStandardNormal(random);
    return Math.max(0, Math.round(approx));
  }

  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

/** Lognormal sample parameterised by median and shape (sigma). */
export function sampleLognormal(median: number, sigma: number, random: RandomSource): number {
  if (!(median > 0)) return 0;
  const mu = Math.log(median);
  return Math.exp(mu + sigma * sampleStandardNormal(random));
}

// ---------------------------------------------------------------------------
// Empirical quantile
// ---------------------------------------------------------------------------

/**
 * Empirical quantile using linear interpolation (the numpy "linear" / type-7
 * convention).  The method is versioned as LINEAR_INTERPOLATION_V1 and is
 * asserted by the mathematical test suite.
 *
 * @param sortedLosses ascending-sorted loss vector (must not be mutated)
 * @param alpha        quantile in [0, 1]
 */
export function empiricalQuantile(sortedLosses: number[], alpha: number): number {
  if (sortedLosses.length === 0) return 0;
  if (alpha <= 0) return sortedLosses[0];
  if (alpha >= 1) return sortedLosses[sortedLosses.length - 1];

  const position = alpha * (sortedLosses.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) return sortedLosses[lowerIndex];

  const fraction = position - lowerIndex;
  return (
    sortedLosses[lowerIndex] + fraction * (sortedLosses[upperIndex] - sortedLosses[lowerIndex])
  );
}
