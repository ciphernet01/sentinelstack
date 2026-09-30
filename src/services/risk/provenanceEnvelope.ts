/**
 * P1.8 — Provenance Envelope
 *
 * The additive `_provenance` block attached to every authoritative risk
 * response.  It is the machine-readable answer to:
 *
 *   "Exactly what data, assumptions, versions and code produced this result?"
 *
 * Kept as a pure function so the response contract can be asserted in tests
 * without a database or HTTP server.
 */

import type { RiskAssessment, RiskRun } from "@prisma/client";

export interface ProvenanceEnvelope {
  /** Identifies the calculation run that produced this result. */
  riskRunId: string;
  /** Identifies the immutable stored assessment. */
  assessmentId: string;
  /** When the assessment row was written. */
  computedAt: string;
  /** Point-in-time the input state was collected for. */
  asOf: string;
  riskEngineVersion: string;
  parameterVersion: string;
  modelBundleVersion: string;
  featureSetVersion: string;
  simulationConfigVersion: string;
  /** sha256 fingerprint of the canonical input bundle. */
  inputStateHash: string;
  /** sha256 fingerprint of the engine/parameter/simulation identity. */
  calculationHash: string;
  /** sha256 fingerprint of the persisted result. */
  resultHash: string | null;
  /** Data coverage at calculation time. */
  coverageState: unknown;
  /** Versioned 0-100 Product Risk Score. */
  riskScore: number;
}

type RiskRunProvenanceSource = Pick<
  RiskRun,
  | "id"
  | "asOf"
  | "riskEngineVersion"
  | "parameterVersion"
  | "modelBundleVersion"
  | "featureSetVersion"
  | "simulationConfigVersion"
  | "inputStateHash"
>;

type AssessmentProvenanceSource = Pick<RiskAssessment, "id" | "computedAt" | "resultHash">;

export function buildProvenanceEnvelope(input: {
  riskRun: RiskRunProvenanceSource;
  assessment: AssessmentProvenanceSource;
  coverageState: unknown;
  calculationHash: string;
  riskScore: number;
}): ProvenanceEnvelope {
  const { riskRun, assessment, coverageState, calculationHash, riskScore } = input;

  return {
    riskRunId: riskRun.id,
    assessmentId: assessment.id,
    computedAt: assessment.computedAt.toISOString(),
    asOf: riskRun.asOf.toISOString(),
    riskEngineVersion: riskRun.riskEngineVersion,
    parameterVersion: riskRun.parameterVersion,
    modelBundleVersion: riskRun.modelBundleVersion,
    featureSetVersion: riskRun.featureSetVersion,
    simulationConfigVersion: riskRun.simulationConfigVersion,
    inputStateHash: riskRun.inputStateHash,
    calculationHash,
    resultHash: assessment.resultHash,
    coverageState,
    riskScore,
  };
}
