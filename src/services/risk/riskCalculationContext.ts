/**
 * P2 — Risk Calculation Context / Result contracts
 *
 * The immutable input to `calculateRisk()` and the authoritative output it
 * produces.  Kept free of Prisma types so the engine remains easily testable
 * and, later, reusable for scenario state mutation (P4) and optimization (P5).
 */

import type { RiskModelBundle, RiskParameterBundle } from "./assumptions.service";
import type { SimulationConfig } from "./simulationConfig.service";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type RiskScopeType = "ENTERPRISE" | "BUSINESS_UNIT" | "SERVICE" | "ASSET";

/** Governed loss parameters for a single asset (P2 spec §12). */
export interface BusinessImpactParameters {
  downtimeCostPerHour: number;
  maxTolerableDowntimeHours: number;
  breachCost: number;
  recoveryCost: number;
  regulatoryExposure: number;
  reputationCost: number;
  currency: string;
  parameterVersion: string;
}

export interface RiskControlContext {
  controlId: string;
  category: string;
  coverage: number;
  effectiveness: number;
  status: string;
}

export interface RiskVulnerabilityContext {
  id: string;
  cve: string | null;
  cvss: number;
  epss: number;
  exploitAvailable: boolean;
  patchAvailable: boolean;
  status: string;
  ageDays: number;
}

export interface RiskTelemetryContext {
  id: string;
  source: string;
  eventType: string;
  severity: string;
  signalScore: number;
  observedAt: string;
}

export interface RiskAssetContext {
  /** External, human-stable asset identifier (CyberAsset.assetId). */
  assetId: string;
  hostname: string;
  serviceName: string;
  businessUnitId: string | null;
  environment: string;
  criticality: string;
  internetExposed: boolean;
  revenueDependencyInr: number;
  dataSensitivity: number;
  businessImpact: BusinessImpactParameters;
  /** 0..1 combined coverage x effectiveness across mapped controls. */
  controlEffectiveness: number;
  controls: RiskControlContext[];
  vulnerabilities: RiskVulnerabilityContext[];
  telemetry: RiskTelemetryContext[];
}

export interface RiskDependencyContext {
  sourceAssetId: string;
  targetAssetId: string;
  dependencyType: string;
  criticality: string;
}

export interface RiskCalculationContext {
  organizationId: string;
  scopeType: RiskScopeType;
  scopeId: string;
  asOf: Date;
  currency: string;

  assets: RiskAssetContext[];
  dependencies: RiskDependencyContext[];

  parameters: RiskParameterBundle;
  modelBundle: RiskModelBundle;
  simulation: SimulationConfig;

  inputStateHash: string;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * Canonical driver vocabulary (P3 spec §6.1).
 *
 * P2 emitted the first seven; P3 widened the union to the full governance
 * vocabulary. Widening is additive, so existing P2 producers stay valid.
 */
export type RiskDriverType =
  | "VULNERABILITY"
  | "EXPOSURE"
  | "THREAT"
  | "CONTROL"
  | "DEPENDENCY"
  | "BUSINESS_IMPACT"
  | "ASSET_CRITICALITY"
  | "SERVICE_CRITICALITY"
  | "TELEMETRY_SIGNAL"
  | "MODEL_SIGNAL"
  | "DATA_COVERAGE"
  | "OTHER";

/** Model/evidence certainty. Distinct from human review status (P3 spec §29). */
export type RiskDriverConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface RiskDriver {
  id: string;
  type: RiskDriverType;
  entityRef: string;
  name: string;
  contributionToEal?: number;
  contributionToVaR?: number;
  contributionToScore?: number;
  direction: "INCREASES_RISK" | "REDUCES_RISK";
  confidence: RiskDriverConfidence;
  evidenceRefs: string[];
}

export interface LossDistributionSummary {
  simulationCount: number;
  mean: number;
  median: number;
  q90: number;
  q95: number;
  q99: number;
  maxSimulated: number;
}

export interface FrequencySummary {
  byEventClass: Array<{
    eventClass: string;
    annualFrequency: number;
    horizonProbability: number;
    expectedAnnualLoss: number;
    cappedProbability: boolean;
  }>;
}

export interface RiskScoreComponents {
  financial: number;
  likelihood: number;
  controls: number;
}

export interface RiskCalculationResult {
  eal: number;
  var95: number;
  var99: number;
  financialExposure: number;
  riskScore: number;
  riskScoreComponents: RiskScoreComponents;

  lossDistributionSummary: LossDistributionSummary;
  frequencySummary: FrequencySummary;
  controlEffectiveness: number;

  drivers: RiskDriver[];

  uncertainty: {
    confidenceLevel: string;
    coverage: Record<string, number>;
    warnings: string[];
    ood: boolean;
  };

  versions: {
    riskEngine: string;
    parameters: string;
    modelBundle: string;
    score: string;
    simulation: string;
  };

  simulation: {
    simulationCount: number;
    seed: number;
    samplingMethod: string;
    quantileMethod: string;
    developmentGrade: boolean;
  };

  inputStateHash: string;
  /** Deterministic fingerprint of the numeric result (excludes timestamps). */
  resultHash: string;
}
