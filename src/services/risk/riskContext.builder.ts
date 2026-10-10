/**
 * P2 — Risk Calculation Context Builder
 *
 * Assembles the immutable `RiskCalculationContext` the engine consumes from the
 * organisation's persisted Digital Twin.
 *
 * Kept separate from `evidenceContext.service.ts`, which owns the canonical
 * *input hash* contract.  This builder owns the *model input* contract: it
 * normalises Prisma rows into governed engine types and attaches the versioned
 * parameter / model / simulation bundles.
 */

import { prisma } from "../../config/db";
import {
  buildModelBundle,
  buildRiskParameters,
  type RiskModelBundle,
  type RiskParameterBundle,
} from "./assumptions.service";
import { buildSimulationConfig, type SimulationConfig } from "./simulationConfig.service";
import type {
  RiskAssetContext,
  RiskCalculationContext,
  RiskControlContext,
  RiskDependencyContext,
  RiskScopeType,
  RiskTelemetryContext,
  RiskVulnerabilityContext,
} from "./riskCalculationContext";
import { EvidenceContextError } from "./errors";

export interface BuildRiskContextOptions {
  organizationId: string;
  scopeType?: RiskScopeType;
  scopeId?: string;
  asOf?: Date;
  /** Canonical input hash produced by evidenceContext.service. */
  inputStateHash: string;
  parameterOverrides?: Partial<RiskParameterBundle>;
  modelOverrides?: Partial<RiskModelBundle>;
  simulationOverrides?: Partial<SimulationConfig>;
  telemetryWindowDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Combined coverage x effectiveness across all mapped controls (0..1). */
export function combineControlEffectiveness(controls: RiskControlContext[]): number {
  if (controls.length === 0) return 0;
  const total = controls.reduce(
    (sum, control) => sum + clamp01(control.coverage) * clamp01(control.effectiveness),
    0
  );
  return clamp01(total / controls.length);
}

export async function buildRiskCalculationContext(
  options: BuildRiskContextOptions
): Promise<RiskCalculationContext> {
  const {
    organizationId,
    scopeType = "ENTERPRISE",
    scopeId = organizationId,
    inputStateHash,
    telemetryWindowDays = 30,
  } = options;

  const asOf = options.asOf ?? new Date();
  const telemetryWindowStart = new Date(asOf.getTime() - telemetryWindowDays * DAY_MS);

  const parameters = buildRiskParameters(options.parameterOverrides);
  const modelBundle = buildModelBundle(options.modelOverrides);
  const simulation = buildSimulationConfig(options.simulationOverrides);

  const assets = await prisma.cyberAsset.findMany({
    where: { organizationId },
    include: {
      vulnerabilities: { where: { status: { not: "RESOLVED" } } },
      controls: { include: { control: true } },
      telemetry: { where: { observedAt: { gte: telemetryWindowStart, lte: asOf } } },
      businessUnit: { select: { id: true, criticality: true, annualRevenueInr: true } },
    },
    orderBy: [{ criticality: "desc" }, { hostname: "asc" }],
  });

  if (assets.length === 0) {
    throw new EvidenceContextError(
      "No cyber assets exist for this organisation; a risk calculation requires a populated digital twin."
    );
  }

  const dependencies = await prisma.assetDependency.findMany({ where: { organizationId } });

  const assetContexts: RiskAssetContext[] = assets.map((asset) => {
    const controls: RiskControlContext[] = asset.controls.map((mapping) => ({
      controlId: mapping.control.controlId,
      category: String(mapping.control.category),
      coverage: clamp01(mapping.coveragePercent / 100),
      effectiveness: clamp01(mapping.effectivenessPercent / 100),
      status: mapping.status,
    }));

    const vulnerabilities: RiskVulnerabilityContext[] = asset.vulnerabilities.map(
      (vulnerability) => ({
        id: vulnerability.id,
        cve: vulnerability.cve,
        cvss: vulnerability.cvss,
        epss: vulnerability.epss,
        exploitAvailable: vulnerability.exploitAvailable,
        patchAvailable: vulnerability.patchAvailable,
        status: vulnerability.status,
        ageDays: Math.max(0, (asOf.getTime() - vulnerability.firstSeenAt.getTime()) / DAY_MS),
      })
    );

    const telemetry: RiskTelemetryContext[] = asset.telemetry.map((event) => ({
      id: event.id,
      source: String(event.source),
      eventType: event.eventType,
      severity: String(event.severity),
      signalScore: event.signalScore,
      observedAt: event.observedAt.toISOString(),
    }));

    return {
      assetId: asset.assetId,
      hostname: asset.hostname,
      serviceName: asset.serviceName,
      businessUnitId: asset.businessUnitId,
      environment: String(asset.environment),
      criticality: String(asset.criticality),
      internetExposed: asset.internetExposed,
      revenueDependencyInr: Number(asset.revenueDependencyInr),
      dataSensitivity: asset.dataSensitivity,
      businessImpact: {
        downtimeCostPerHour: Number(asset.downtimeCostPerHourInr),
        maxTolerableDowntimeHours: asset.maxTolerableDowntimeHours,
        breachCost: Number(asset.breachCostInr),
        recoveryCost: Number(asset.recoveryCostInr),
        regulatoryExposure: Number(asset.regulatoryExposureInr),
        reputationCost: Number(asset.reputationCostInr),
        currency: parameters.currency,
        parameterVersion: parameters.parameterVersion,
      },
      controlEffectiveness: combineControlEffectiveness(controls),
      controls,
      vulnerabilities,
      telemetry,
    };
  });

  const dependencyContexts: RiskDependencyContext[] = dependencies.map((dependency) => ({
    sourceAssetId:
      assets.find((asset) => asset.id === dependency.sourceAssetId)?.assetId ??
      dependency.sourceAssetId,
    targetAssetId:
      assets.find((asset) => asset.id === dependency.targetAssetId)?.assetId ??
      dependency.targetAssetId,
    dependencyType: dependency.dependencyType,
    criticality: String(dependency.criticality),
  }));

  return {
    organizationId,
    scopeType,
    scopeId,
    asOf,
    currency: parameters.currency,
    assets: assetContexts,
    dependencies: dependencyContexts,
    parameters,
    modelBundle,
    simulation,
    inputStateHash,
  };
}

