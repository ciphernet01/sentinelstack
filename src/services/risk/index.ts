/**
 * P1/P2 — PS 26105 Risk Domain barrel.
 *
 * Single import surface for the risk-run / lineage / assessment foundation.
 * Later phases (P2+) add the calculation modules (likelihood, frequency,
 * severity, dependency, lossDistribution, riskScore, driverAttribution) here.
 */

// ── Errors ──────────────────────────────────────────────────────────────────
export {
  RiskDomainError,
  EvidenceContextError,
  InvalidStateTransitionError,
  RiskRunNotFoundError,
  isRiskDomainError,
} from "./errors";

// ── Evidence / input bundle ─────────────────────────────────────────────────
export { buildEvidenceContext, buildCoverageState } from "./evidenceContext.service";
export type {
  EvidenceContext,
  EvidenceContextOptions,
  CoverageState,
} from "./evidenceContext.service";

// ── Calculation identity ────────────────────────────────────────────────────
export {
  computeCalculationHash,
  computeCalculationHashForRun,
  calculationIdentityFromRun,
} from "./calculationHash.service";
export type { CalculationIdentity } from "./calculationHash.service";

// ── Provenance envelope ─────────────────────────────────────────────────────
export { buildProvenanceEnvelope } from "./provenanceEnvelope";
export type { ProvenanceEnvelope } from "./provenanceEnvelope";

// ── Tenant scope ────────────────────────────────────────────────────────────
export {
  resolveOrganizationIdStrict,
  resolveOrganizationIdWithAdminOverride,
} from "./tenantScope";
export type { TenantScopeRequest } from "./tenantScope";

// ── Run lifecycle ───────────────────────────────────────────────────────────
export {
  RISK_RUN_TRANSITIONS,
  assertValidTransition,
  createRiskRun,
  markRiskRunRunning,
  markRiskRunSucceeded,
  markRiskRunFailed,
  staleOlderRuns,
  getLatestSucceededRun,
  getAssessmentById,
  listAssessments,
  persistRiskAssessment,
  appendRiskAuditEvent,
} from "./riskRun.service";
export type { CreateRiskRunOptions } from "./riskRun.service";

// ── Façade ──────────────────────────────────────────────────────────────────
export {
  RiskAssessmentService,
  riskAssessmentService,
  RISK_ENGINE_VERSION,
  RISK_ENGINE_VERSION_V1,
  PARAMETER_VERSION,
  MODEL_BUNDLE_VERSION,
  FEATURE_SET_VERSION,
  SIMULATION_CONFIG_VERSION,
  SIMULATION_CONFIG_VERSION_V1,
} from "./riskAssessment.service";
export type { RunRiskOptions, SupportedRiskEngineVersion } from "./riskAssessment.service";

// ── P2 — Monte Carlo Risk Engine v2 ────────────────────────────────────────
export {
  RISK_ENGINE_VERSION_V2,
  COVERAGE_STATE_VERSION,
  calculateRisk,
  canonicalResultPayload,
  grossFinancialExposure,
  enterpriseControlEffectiveness,
  aggregateConfidence,
} from "./riskEngine.service";
export type {
  RiskEngineResult,
  ModelledEventClass,
} from "./riskEngine.service";

export { buildRiskCalculationContext, combineControlEffectiveness } from "./riskContext.builder";
export type { BuildRiskContextOptions } from "./riskContext.builder";

export type {
  RiskCalculationContext,
  RiskCalculationResult,
  RiskAssetContext,
  RiskControlContext,
  RiskVulnerabilityContext,
  RiskTelemetryContext,
  RiskDependencyContext,
  RiskDriver,
  RiskDriverType,
  RiskScoreComponents,
  BusinessImpactParameters,
  RiskScopeType,
} from "./riskCalculationContext";

export { DEFAULT_RISK_PARAMETERS, DEFAULT_MODEL_BUNDLE, buildRiskParameters, buildModelBundle } from "./assumptions.service";
export type { RiskParameterBundle, RiskModelBundle, RiskScoreWeights } from "./assumptions.service";

export {
  DEFAULT_SIMULATION_CONFIG,
  PRODUCTION_MIN_SIMULATIONS,
  buildSimulationConfig,
  simulationConfigHash,
  createSeededRandom,
} from "./simulationConfig.service";
export type { SimulationConfig } from "./simulationConfig.service";

export { EVENT_CLASSES, aggregateEnterpriseSignals, extractAssetEventEvidence, SIGNAL_MODEL_VERSION } from "./evidenceSignals.service";
export type { EnterpriseEventSignal, EventClass } from "./evidenceSignals.service";

export {
  deterministicLikelihoodProvider,
  probabilityFromAnnualRate,
  confidenceFromEvidence,
  OOD_ANNUAL_RATE_THRESHOLD,
} from "./likelihood.service";
export type { LikelihoodEstimate, LikelihoodProvider, ConfidenceLevel } from "./likelihood.service";

export {
  probabilityToAnnualFrequency,
  annualFrequencyFromAnnualProbability,
  NEAR_CERTAIN_CAP_POLICY,
} from "./frequency.service";

export {
  composeSeverityScale,
  severityComponentAmounts,
  expectedSeverity,
  sampleEventSeverity,
  dominantSeverityComponent,
  LOSS_COMPONENTS,
  LOSS_COMPONENT_OWNERS,
  SEVERITY_COMPOSITION_VERSION,
} from "./severity.service";
export type { SeverityScale, SeverityComponent, LossComponent } from "./severity.service";

export { computeBlastRadius, computeBlastRadiusMap, normalizeDependencyStrength } from "./dependency.service";
export type { BlastRadiusResult } from "./dependency.service";

export { simulateAggregateAnnualLoss } from "./lossDistribution.service";
export type { EventClassModel, LossDistributionResult } from "./lossDistribution.service";

export { calculateRiskScore } from "./riskScore.service";
export type { RiskScoreInput, RiskScoreResult } from "./riskScore.service";

export {
  DRIVER_ATTRIBUTION_METHOD,
  analyticEnterpriseLoss,
  attributeDrivers,
} from "./driverAttribution.service";
export type { AttributionInput, AnalyticLossResult, CounterfactualState } from "./driverAttribution.service";

