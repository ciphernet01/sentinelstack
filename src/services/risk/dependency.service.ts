/**
 * P2 — Dependency / Blast Radius
 *
 * Models impact propagation through the Digital Twin dependency graph without
 * allowing unbounded multiplication (P2 spec §14).
 *
 * Rule:
 *   propagated_multiplier = 1 + min(cap - 1, Σ normalized_dependency_strength)
 *
 * where a dependency contributes to the *target* asset's multiplier because a
 * compromise of the target disrupts everything that depends on it.  Summing
 * strengths and capping the total is what prevents "the same loss counted
 * three times" down a chain.
 */

import type { RiskDependencyContext } from "./riskCalculationContext";
import type { RiskParameterBundle } from "./assumptions.service";

/** Criticality weighting applied to a dependent's contribution. */
const DEPENDENT_CRITICALITY_FACTOR: Record<string, number> = {
  LOW: 0.5,
  MODERATE: 0.75,
  HIGH: 1,
  CRITICAL: 1.25,
};

export interface BlastRadiusContribution {
  dependentAssetId: string;
  dependencyType: string;
  criticality: string;
  /** Normalized strength after criticality weighting. */
  strength: number;
}

export interface BlastRadiusResult {
  /** Multiplier applied to the target asset's severity. Always >= 1. */
  multiplier: number;
  /** True when the amplification cap was engaged. */
  capped: boolean;
  dependents: BlastRadiusContribution[];
}

/** Normalized (0..1) strength for a dependency type, from the parameter bundle. */
export function normalizeDependencyStrength(
  dependencyType: string,
  parameters: RiskParameterBundle
): number {
  const raw = parameters.dependencyStrengthByType[dependencyType] ?? 0.4;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Compute the blast-radius multiplier for a single target asset.
 *
 * @param targetAssetId  the asset whose compromise is being modelled
 * @param dependencies   all in-scope dependency edges
 */
export function computeBlastRadius(
  targetAssetId: string,
  dependencies: RiskDependencyContext[],
  parameters: RiskParameterBundle
): BlastRadiusResult {
  const dependents: BlastRadiusContribution[] = [];

  for (const dependency of dependencies) {
    if (dependency.targetAssetId !== targetAssetId) continue;

    const baseStrength = normalizeDependencyStrength(dependency.dependencyType, parameters);
    const criticalityFactor = DEPENDENT_CRITICALITY_FACTOR[dependency.criticality] ?? 1;

    dependents.push({
      dependentAssetId: dependency.sourceAssetId,
      dependencyType: dependency.dependencyType,
      criticality: dependency.criticality,
      strength: baseStrength * criticalityFactor,
    });
  }

  const rawAmplification = dependents.reduce((sum, dependent) => sum + dependent.strength, 0);
  const maxAmplification = Math.max(0, parameters.dependencyAmplificationCap - 1);
  const cappedAmplification = Math.min(maxAmplification, rawAmplification);

  return {
    multiplier: 1 + cappedAmplification,
    capped: rawAmplification > maxAmplification,
    dependents,
  };
}

/** Precompute blast radius for every asset in one pass. */
export function computeBlastRadiusMap(
  assetIds: string[],
  dependencies: RiskDependencyContext[],
  parameters: RiskParameterBundle
): Map<string, BlastRadiusResult> {
  const map = new Map<string, BlastRadiusResult>();
  for (const assetId of assetIds) {
    map.set(assetId, computeBlastRadius(assetId, dependencies, parameters));
  }
  return map;
}
