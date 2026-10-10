/**
 * P1 — Calculation Hash Service
 *
 * Separates the two identities that every authoritative risk result needs:
 *
 *   inputStateHash    — fingerprint of the material enterprise state
 *                       (assets, vulnerabilities, controls, telemetry, scope).
 *   calculationHash   — fingerprint of *how* that state was turned into a
 *                       result: engine version, parameter bundle, model
 *                       bundle, feature set and simulation configuration.
 *
 * Two runs with the same input state but different engine/parameter versions
 * must produce different calculation hashes, and two runs with identical
 * inputs *and* identical configuration must produce identical hashes.
 *
 * The calculation hash is derived (not stored) so it can be recomputed from
 * the RiskRun columns at any time and verified against any historical record.
 */

import { hashRiskResult } from "../provenance/canonicalHash.service";
import type { RiskRun } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The subset of run metadata that determines *how* a result was computed. */
export interface CalculationIdentity {
  riskEngineVersion: string;
  parameterVersion: string;
  modelBundleVersion: string;
  featureSetVersion: string;
  simulationConfigVersion: string;
  inputStateHash: string;
  scopeType: string;
  scopeId: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Extract the calculation identity from a persisted RiskRun record. */
export function calculationIdentityFromRun(
  run: Pick<
    RiskRun,
    | "riskEngineVersion"
    | "parameterVersion"
    | "modelBundleVersion"
    | "featureSetVersion"
    | "simulationConfigVersion"
    | "inputStateHash"
    | "scopeType"
    | "scopeId"
  >
): CalculationIdentity {
  return {
    riskEngineVersion: run.riskEngineVersion,
    parameterVersion: run.parameterVersion,
    modelBundleVersion: run.modelBundleVersion,
    featureSetVersion: run.featureSetVersion,
    simulationConfigVersion: run.simulationConfigVersion,
    inputStateHash: run.inputStateHash,
    scopeType: run.scopeType,
    scopeId: run.scopeId,
  };
}

/**
 * Compute the deterministic calculation hash.
 *
 * @returns "sha256:<hex-digest>"
 */
export function computeCalculationHash(identity: CalculationIdentity): string {
  return hashRiskResult({ kind: "risk-calculation", ...identity });
}

/** Convenience: calculation hash straight from a persisted RiskRun. */
export function computeCalculationHashForRun(
  run: Pick<
    RiskRun,
    | "riskEngineVersion"
    | "parameterVersion"
    | "modelBundleVersion"
    | "featureSetVersion"
    | "simulationConfigVersion"
    | "inputStateHash"
    | "scopeType"
    | "scopeId"
  >
): string {
  return computeCalculationHash(calculationIdentityFromRun(run));
}
