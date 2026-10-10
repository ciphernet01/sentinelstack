/**
 * P2 — Risk Engine test fixtures
 *
 * Builds the governed `RiskCalculationContext` the Monte Carlo engine consumes
 * directly, without a database.  Assets are deliberately small so expected
 * behaviour (monotonicity, determinism, attribution sign) is easy to assert.
 */

import {
  buildModelBundle,
  buildRiskParameters,
  type RiskModelBundle,
  type RiskParameterBundle,
} from "../../src/services/risk/assumptions.service";
import {
  buildSimulationConfig,
  type SimulationConfig,
} from "../../src/services/risk/simulationConfig.service";
import { combineControlEffectiveness } from "../../src/services/risk/riskContext.builder";
import type {
  BusinessImpactParameters,
  RiskAssetContext,
  RiskCalculationContext,
  RiskControlContext,
  RiskDependencyContext,
  RiskTelemetryContext,
  RiskVulnerabilityContext,
} from "../../src/services/risk/riskCalculationContext";

export const ENGINE_TEST_ORG_ID = "org_acme_test";
export const ENGINE_TEST_INPUT_HASH = "sha256:engine-test-input-state";

/** EDR event types the signal model maps to the RANSOMWARE class. */
export const RANSOMWARE_EVENT_TYPES = [
  "SUSPICIOUS_PROCESS_EXECUTION",
  "MALWARE_DETECTED",
  "RANSOM_NOTE_WRITE",
] as const;

export function defaultBusinessImpact(
  parameters: RiskParameterBundle,
  overrides: Partial<BusinessImpactParameters> = {}
): BusinessImpactParameters {
  return {
    downtimeCostPerHour: 2_000_000,
    maxTolerableDowntimeHours: 8,
    breachCost: 25_000_000,
    recoveryCost: 10_000_000,
    regulatoryExposure: 15_000_000,
    reputationCost: 5_000_000,
    currency: parameters.currency,
    parameterVersion: parameters.parameterVersion,
    ...overrides,
  };
}

export function buildVulnerability(
  id: string,
  overrides: Partial<RiskVulnerabilityContext> = {}
): RiskVulnerabilityContext {
  return {
    id,
    cve: `CVE-2026-${id.slice(-3)}`,
    cvss: 9.1,
    epss: 0.62,
    exploitAvailable: true,
    patchAvailable: false,
    status: "OPEN",
    ageDays: 45,
    ...overrides,
  };
}

export function buildTelemetry(
  id: string,
  index: number,
  overrides: Partial<RiskTelemetryContext> = {}
): RiskTelemetryContext {
  return {
    id,
    source: "EDR",
    eventType: RANSOMWARE_EVENT_TYPES[index % RANSOMWARE_EVENT_TYPES.length],
    severity: "HIGH",
    signalScore: 0.8,
    observedAt: new Date(Date.UTC(2026, 8, 20 + index)).toISOString(),
    ...overrides,
  };
}

export function buildControl(
  controlId: string,
  category: string,
  coverage: number,
  effectiveness: number
): RiskControlContext {
  return {
    controlId,
    category,
    coverage,
    effectiveness,
    status: effectiveness >= 0.9 ? "IMPLEMENTED" : "PARTIAL",
  };
}

export interface EngineAssetOptions {
  assetId?: string;
  internetExposed?: boolean;
  criticality?: string;
  controls?: RiskControlContext[];
  vulnerabilities?: RiskVulnerabilityContext[];
  telemetry?: RiskTelemetryContext[];
  businessImpact?: Partial<BusinessImpactParameters>;
  parameters?: RiskParameterBundle;
}

/**
 * A loss-bearing asset with real evidence.  Control effectiveness is always
 * derived from the control list so the fixture cannot drift out of sync.
 */
export function buildEngineAsset(options: EngineAssetOptions = {}): RiskAssetContext {
  const parameters = options.parameters ?? buildRiskParameters();
  const controls = options.controls ?? [buildControl("ctl-patch", "PATCH", 0.5, 0.4)];
  const assetWithoutEffectiveness: RiskAssetContext = {
    assetId: options.assetId ?? "ASSET-001",
    hostname: `${(options.assetId ?? "ASSET-001").toLowerCase()}.acme.internal`,
    serviceName: "payments-api",
    businessUnitId: "bu_payments",
    environment: "PRODUCTION",
    criticality: options.criticality ?? "CRITICAL",
    internetExposed: options.internetExposed ?? true,
    revenueDependencyInr: 50_000_000,
    dataSensitivity: 4,
    businessImpact: defaultBusinessImpact(parameters, options.businessImpact),
    controlEffectiveness: 0,
    controls,
    vulnerabilities: options.vulnerabilities ?? [buildVulnerability("vuln-001")],
    telemetry: options.telemetry ?? [buildTelemetry("tel-001", 0), buildTelemetry("tel-002", 1)],
  };

  return {
    ...assetWithoutEffectiveness,
    controlEffectiveness: combineControlEffectiveness(controls),
  };
}

export function buildDependency(
  sourceAssetId: string,
  targetAssetId: string,
  dependencyType = "DATA"
): RiskDependencyContext {
  return { sourceAssetId, targetAssetId, dependencyType, criticality: "CRITICAL" };
}

export interface EngineContextOptions {
  organizationId?: string;
  scopeType?: RiskCalculationContext["scopeType"];
  scopeId?: string;
  asOf?: Date;
  inputStateHash?: string;
  parameters?: Partial<RiskParameterBundle>;
  modelBundle?: Partial<RiskModelBundle>;
  simulation?: Partial<SimulationConfig>;
}

export function buildEngineContext(
  assets: RiskAssetContext[],
  dependencies: RiskDependencyContext[] = [],
  options: EngineContextOptions = {}
): RiskCalculationContext {
  const parameters = buildRiskParameters(options.parameters);

  return {
    organizationId: options.organizationId ?? ENGINE_TEST_ORG_ID,
    scopeType: options.scopeType ?? "ENTERPRISE",
    scopeId: options.scopeId ?? options.organizationId ?? ENGINE_TEST_ORG_ID,
    asOf: options.asOf ?? new Date(Date.UTC(2026, 8, 30)),
    currency: parameters.currency,
    assets,
    dependencies,
    parameters,
    modelBundle: buildModelBundle(options.modelBundle),
    simulation: buildSimulationConfig({ simulationCount: 5_000, ...options.simulation }),
    inputStateHash: options.inputStateHash ?? ENGINE_TEST_INPUT_HASH,
  };
}
