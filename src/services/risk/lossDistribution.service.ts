/**
 * P2 — Aggregate Annual Loss Distribution (Monte Carlo)
 *
 * Reference procedure (P2 spec §16.1), per simulation:
 *   1. sample the annual event count N_i for each event class
 *   2. sample each incident's severity
 *   3. apply dependency/correlation handling (already folded into the scale)
 *   4. aggregate all event losses into S
 * Repeating M times yields the annual loss distribution from which EAL, VaR95
 * and VaR99 are derived.
 *
 * Raw simulation vectors are deliberately NOT persisted; only the summary
 * statistics are stored on the assessment.
 */

import type { EventClass } from "./evidenceSignals.service";
import type { SeverityScale } from "./severity.service";
import { sampleEventSeverity } from "./severity.service";
import {
  createSeededRandom,
  empiricalQuantile,
  samplePoisson,
  type RandomSource,
  type SimulationConfig,
} from "./simulationConfig.service";
import type { LossDistributionSummary } from "./riskCalculationContext";

export interface EventClassModel {
  eventClass: EventClass;
  /** Annualised Poisson event rate (lambda). */
  annualFrequency: number;
  /** Per-asset severity scales eligible to host an incident of this class. */
  severityScales: SeverityScale[];
}

export interface EventClassSimulation {
  eventClass: EventClass;
  annualFrequency: number;
  meanLoss: number;
  q95: number;
  q99: number;
}

export interface LossDistributionResult {
  /** Ascending-sorted simulated annual losses. */
  sortedLosses: number[];
  summary: LossDistributionSummary;
  byEventClass: EventClassSimulation[];
  /** Total simulated incidents across all event classes. */
  totalSimulatedEvents: number;
}

interface WeightedScale {
  scale: SeverityScale;
  cumulativeWeight: number;
}

/**
 * Build a cumulative-weight table so incidents are allocated to assets in
 * proportion to their modelled loss scale.  This is a deterministic allocation
 * rule (P2 spec §14.3 primary association) rather than an even split.
 */
function buildWeightedScales(scales: SeverityScale[]): WeightedScale[] {
  const eligible = scales.filter((scale) => scale.medianLoss > 0);
  const totalWeight = eligible.reduce((sum, scale) => sum + scale.medianLoss, 0);

  if (totalWeight <= 0) {
    // No monetary exposure for this class: every incident has zero severity.
    return [];
  }

  let running = 0;
  return eligible.map((scale) => {
    running += scale.medianLoss / totalWeight;
    return { scale, cumulativeWeight: running };
  });
}

function pickWeightedScale(table: WeightedScale[], random: RandomSource): SeverityScale | null {
  if (table.length === 0) return null;
  const draw = random();
  for (const entry of table) {
    if (draw <= entry.cumulativeWeight) return entry.scale;
  }
  return table[table.length - 1].scale;
}

function summarise(sortedLosses: number[]): LossDistributionSummary {
  const simulationCount = sortedLosses.length;
  if (simulationCount === 0) {
    return { simulationCount: 0, mean: 0, median: 0, q90: 0, q95: 0, q99: 0, maxSimulated: 0 };
  }

  const total = sortedLosses.reduce((sum, loss) => sum + loss, 0);

  return {
    simulationCount,
    mean: total / simulationCount,
    median: empiricalQuantile(sortedLosses, 0.5),
    q90: empiricalQuantile(sortedLosses, 0.9),
    q95: empiricalQuantile(sortedLosses, 0.95),
    q99: empiricalQuantile(sortedLosses, 0.99),
    maxSimulated: sortedLosses[simulationCount - 1],
  };
}

/**
 * Simulate the enterprise annual aggregate loss distribution.
 *
 * Deterministic for a fixed (models, config).  Uses a single seeded stream so
 * results are byte-for-byte reproducible across processes.
 */
export function simulateAggregateAnnualLoss(
  models: EventClassModel[],
  config: SimulationConfig,
  random: RandomSource = createSeededRandom(config.seed)
): LossDistributionResult {
  const tables = models.map((model) => ({
    model,
    table: buildWeightedScales(model.severityScales),
    perClassLosses: [] as number[],
  }));

  const losses: number[] = new Array(config.simulationCount);
  let totalSimulatedEvents = 0;

  for (let simulation = 0; simulation < config.simulationCount; simulation += 1) {
    let aggregateLoss = 0;

    for (const entry of tables) {
      const eventCount = samplePoisson(entry.model.annualFrequency, random);
      if (eventCount <= 0) continue;

      totalSimulatedEvents += eventCount;

      let classLoss = 0;
      for (let event = 0; event < eventCount; event += 1) {
        const scale = pickWeightedScale(entry.table, random);
        if (!scale) continue;
        classLoss += sampleEventSeverity(scale, random);
      }

      entry.perClassLosses.push(classLoss);
      aggregateLoss += classLoss;
    }

    losses[simulation] = aggregateLoss;
  }

  const sortedLosses = losses.slice().sort((a, b) => a - b);

  const byEventClass: EventClassSimulation[] = tables.map((entry) => {
    const classLosses = entry.perClassLosses.slice().sort((a, b) => a - b);
    const mean =
      classLosses.length > 0
        ? classLosses.reduce((sum, loss) => sum + loss, 0) / classLosses.length
        : 0;

    return {
      eventClass: entry.model.eventClass,
      annualFrequency: entry.model.annualFrequency,
      meanLoss: mean,
      q95: empiricalQuantile(classLosses, 0.95),
      q99: empiricalQuantile(classLosses, 0.99),
    };
  });

  return {
    sortedLosses,
    summary: summarise(sortedLosses),
    byEventClass,
    totalSimulatedEvents,
  };
}
