import { prisma } from '../config/db';

const INR_CRORE = 10_000_000;

const criticalityMultiplier: Record<string, number> = {
  LOW: 0.75,
  MODERATE: 1,
  HIGH: 1.25,
  CRITICAL: 1.55,
};

const severitySignal: Record<string, number> = {
  INFO: 0.005,
  LOW: 0.01,
  MEDIUM: 0.025,
  HIGH: 0.045,
  CRITICAL: 0.075,
};

const toNumber = (value: unknown) => Number(value ?? 0);
const roundInr = (value: number) => BigInt(Math.max(0, Math.round(value)));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type RiskAsset = Awaited<ReturnType<typeof loadRiskAssets>>[number];

const loadRiskAssets = (organizationId: string) =>
  prisma.cyberAsset.findMany({
    where: { organizationId },
    include: {
      businessUnit: true,
      vulnerabilities: {
        where: { status: 'OPEN' },
      },
      controls: {
        include: { control: true },
      },
      telemetry: {
        where: {
          observedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { observedAt: 'desc' },
        take: 25,
      },
    },
    orderBy: [{ criticality: 'desc' }, { hostname: 'asc' }],
  });

const calculateAssetImpact = (asset: RiskAsset) => {
  const downtimeLoss =
    toNumber(asset.downtimeCostPerHourInr) * Math.max(1, asset.maxTolerableDowntimeHours);
  return (
    downtimeLoss +
    toNumber(asset.breachCostInr) +
    toNumber(asset.recoveryCostInr) +
    toNumber(asset.regulatoryExposureInr) +
    toNumber(asset.reputationCostInr)
  );
};

const calculateControlEffectiveness = (asset: RiskAsset) => {
  if (asset.controls.length === 0) return 0;

  const weighted = asset.controls.reduce((sum, control) => {
    const coverage = clamp(control.coveragePercent, 0, 100) / 100;
    const effectiveness = clamp(control.effectivenessPercent, 0, 100) / 100;
    return sum + coverage * effectiveness;
  }, 0);

  return clamp(weighted / asset.controls.length, 0, 1);
};

const calculateLikelihood = (asset: RiskAsset, controlEffectiveness: number) => {
  const vulnSignal = asset.vulnerabilities.reduce((sum, vulnerability) => {
    const cvssComponent = clamp(vulnerability.cvss / 10, 0, 1) * 0.035;
    const epssComponent = clamp(vulnerability.epss, 0, 1) * 0.08;
    const exploitComponent = vulnerability.exploitAvailable ? 0.04 : 0;
    const patchLagDays = Math.max(
      0,
      (Date.now() - vulnerability.firstSeenAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    const ageComponent = patchLagDays > 30 ? 0.02 : patchLagDays > 7 ? 0.01 : 0;
    return sum + cvssComponent + epssComponent + exploitComponent + ageComponent;
  }, 0);

  const telemetrySignal = asset.telemetry.reduce((sum, event) => {
    return sum + (severitySignal[event.severity] ?? 0.01) * clamp(event.signalScore || 1, 0.25, 2);
  }, 0);

  const exposureMultiplier = asset.internetExposed ? 1.35 : 1;
  const businessMultiplier = criticalityMultiplier[asset.criticality] ?? 1;
  const raw = (0.015 + vulnSignal + telemetrySignal) * exposureMultiplier * businessMultiplier;
  const controlAdjusted = raw * (1 - controlEffectiveness * 0.55);

  return clamp(controlAdjusted, 0.005, 0.7);
};

const assetRiskRow = (asset: RiskAsset) => {
  const impactInr = calculateAssetImpact(asset);
  const controlEffectiveness = calculateControlEffectiveness(asset);
  const annualLikelihood = calculateLikelihood(asset, controlEffectiveness);
  const expectedAnnualLossInr = impactInr * annualLikelihood;
  const valueAtRisk95Inr = impactInr * clamp(annualLikelihood * 2.2, 0.05, 1);

  return {
    assetId: asset.id,
    externalAssetId: asset.assetId,
    hostname: asset.hostname,
    serviceName: asset.serviceName,
    businessUnit: asset.businessUnit?.name ?? 'Unassigned',
    criticality: asset.criticality,
    internetExposed: asset.internetExposed,
    impactInr: Math.round(impactInr),
    annualLikelihood,
    expectedAnnualLossInr: Math.round(expectedAnnualLossInr),
    valueAtRisk95Inr: Math.round(valueAtRisk95Inr),
    controlEffectiveness,
    openVulnerabilities: asset.vulnerabilities.length,
    exploitableVulnerabilities: asset.vulnerabilities.filter((v) => v.exploitAvailable).length,
    topVulnerabilities: asset.vulnerabilities
      .slice()
      .sort((a, b) => b.cvss + b.epss - (a.cvss + a.epss))
      .slice(0, 3)
      .map((v) => ({
        id: v.id,
        cve: v.cve,
        title: v.title,
        cvss: v.cvss,
        epss: v.epss,
        exploitAvailable: v.exploitAvailable,
        patchAvailable: v.patchAvailable,
      })),
  };
};

const buildRecommendations = (rows: ReturnType<typeof assetRiskRow>[], assets: RiskAsset[]) => {
  const byAsset = new Map(assets.map((asset) => [asset.id, asset]));
  const recommendations: Array<{
    id: string;
    title: string;
    assetId: string;
    serviceName: string;
    costInr: number;
    estimatedEalReductionInr: number;
    category: string;
  }> = [];

  for (const row of rows) {
    const asset = byAsset.get(row.assetId);
    if (!asset) continue;

    const criticalPatchCount = asset.vulnerabilities.filter(
      (v) => v.patchAvailable && v.cvss >= 8,
    ).length;
    if (criticalPatchCount > 0) {
      recommendations.push({
        id: `patch:${asset.id}`,
        title: `Patch ${criticalPatchCount} critical/high vulnerabilities on ${asset.serviceName}`,
        assetId: asset.id,
        serviceName: asset.serviceName,
        costInr: 350_000 + criticalPatchCount * 125_000,
        estimatedEalReductionInr: Math.round(row.expectedAnnualLossInr * 0.28),
        category: 'PATCHING',
      });
    }

    const mfa = asset.controls.find((c) => c.control.controlId === 'CTRL-IAM-MFA');
    if (!mfa || mfa.effectivenessPercent < 85) {
      recommendations.push({
        id: `mfa:${asset.id}`,
        title: `Raise privileged MFA coverage for ${asset.serviceName}`,
        assetId: asset.id,
        serviceName: asset.serviceName,
        costInr: 650_000,
        estimatedEalReductionInr: Math.round(row.expectedAnnualLossInr * 0.18),
        category: 'IAM',
      });
    }

    if (asset.internetExposed && row.expectedAnnualLossInr > 1_000_000) {
      recommendations.push({
        id: `segment:${asset.id}`,
        title: `Segment and restrict internet exposure for ${asset.serviceName}`,
        assetId: asset.id,
        serviceName: asset.serviceName,
        costInr: 1_800_000,
        estimatedEalReductionInr: Math.round(row.expectedAnnualLossInr * 0.34),
        category: 'NETWORK',
      });
    }
  }

  return recommendations.sort((a, b) => b.estimatedEalReductionInr - a.estimatedEalReductionInr);
};

const optimizeRecommendations = (
  recommendations: ReturnType<typeof buildRecommendations>,
  budgetInr: number,
) => {
  const sorted = recommendations
    .slice()
    .sort((a, b) => b.estimatedEalReductionInr / b.costInr - a.estimatedEalReductionInr / a.costInr);

  const selected = [];
  let spend = 0;
  let reduction = 0;

  for (const recommendation of sorted) {
    if (spend + recommendation.costInr > budgetInr) continue;
    selected.push(recommendation);
    spend += recommendation.costInr;
    reduction += recommendation.estimatedEalReductionInr;
  }

  return {
    budgetInr,
    selected,
    spendInr: spend,
    estimatedRiskReductionInr: reduction,
    rosi: spend > 0 ? Number(((reduction - spend) / spend).toFixed(2)) : 0,
  };
};

const scenarioPresets = {
  MFA_PRIVILEGED_USERS: {
    name: 'Implement MFA for all privileged accounts',
    ealMultiplier: 0.78,
    unitCostInr: 180_000,
    affectedAsset: (asset: RiskAsset) => asset.controls.some((c) => c.control.controlId === 'CTRL-IAM-MFA' && c.effectivenessPercent < 85),
    modeledChanges: {
      control: 'CTRL-IAM-MFA',
      targetState: '100% privileged account MFA coverage',
      affectedModelInput: 'annual incident likelihood',
      likelihoodReductionFactor: 0.22,
    },
  },
  PATCH_CRITICAL_VULNERABILITIES: {
    name: 'Patch all exploitable critical vulnerabilities',
    ealMultiplier: 0.72,
    unitCostInr: 140_000,
    affectedAsset: (asset: RiskAsset) => asset.vulnerabilities.some((v) => v.exploitAvailable && v.cvss >= 8),
    modeledChanges: {
      control: 'PATCHING',
      targetState: 'all exploitable CVSS >= 8 vulnerabilities remediated',
      affectedModelInput: 'CVSS/EPSS/exploitability signal',
      likelihoodReductionFactor: 0.28,
    },
  },
  NETWORK_SEGMENTATION: {
    name: 'Segment all internet-facing critical services',
    ealMultiplier: 0.69,
    unitCostInr: 900_000,
    affectedAsset: (asset: RiskAsset) => asset.internetExposed,
    modeledChanges: {
      control: 'CTRL-NET-SEG',
      targetState: 'critical services isolated behind restricted ingress paths',
      affectedModelInput: 'internet exposure multiplier',
      likelihoodReductionFactor: 0.31,
    },
  },
  EDR_ROLLOUT: {
    name: 'Expand EDR to weakly covered endpoints',
    ealMultiplier: 0.84,
    unitCostInr: 220_000,
    affectedAsset: (asset: RiskAsset) => asset.controls.some((c) => c.control.controlId === 'CTRL-ENDPOINT-EDR' && c.effectivenessPercent < 85),
    modeledChanges: {
      control: 'CTRL-ENDPOINT-EDR',
      targetState: 'EDR effectiveness >= 85% on modeled assets',
      affectedModelInput: 'telemetry detection and response effectiveness',
      likelihoodReductionFactor: 0.16,
    },
  },
  CLOUD_HARDENING: {
    name: 'Harden cloud misconfigurations and excessive privilege',
    ealMultiplier: 0.81,
    unitCostInr: 260_000,
    affectedAsset: (asset: RiskAsset) => asset.environment === 'CLOUD',
    modeledChanges: {
      control: 'CTRL-CLOUD-CSPM',
      targetState: 'CSPM control effectiveness >= 85% for cloud assets',
      affectedModelInput: 'cloud exposure and misconfiguration signal',
      likelihoodReductionFactor: 0.19,
    },
  },
} as const;

type ScenarioType = keyof typeof scenarioPresets;

const isScenarioType = (value: string): value is ScenarioType => value in scenarioPresets;

const modelScenario = (
  type: ScenarioType,
  baselineEalInr: number,
  assets: RiskAsset[],
  customBudgetInr?: number,
) => {
  const preset = scenarioPresets[type];
  const affectedAssets = assets.filter(preset.affectedAsset);
  const implementationCostInr = Math.max(0, affectedAssets.length * preset.unitCostInr);
  const simulatedEalInr = Math.round(baselineEalInr * preset.ealMultiplier);
  const riskReductionInr = Math.max(0, baselineEalInr - simulatedEalInr);
  const budgetInr = typeof customBudgetInr === 'number' && customBudgetInr > 0 ? customBudgetInr : implementationCostInr;

  return {
    name: preset.name,
    type,
    budgetInr,
    baselineEalInr,
    simulatedEalInr,
    riskReductionInr,
    implementationCostInr,
    rosi:
      implementationCostInr > 0
        ? Number(((riskReductionInr - implementationCostInr) / implementationCostInr).toFixed(2))
        : 0,
    modeledChanges: {
      ...preset.modeledChanges,
      affectedAssets: affectedAssets.map((asset) => ({
        id: asset.id,
        assetId: asset.assetId,
        serviceName: asset.serviceName,
        criticality: asset.criticality,
        internetExposed: asset.internetExposed,
      })),
      affectedAssetCount: affectedAssets.length,
      budgetFeasible: implementationCostInr <= budgetInr,
      modelCaveat: 'Scenario output is modeled decision support, not an observed future fact.',
    },
  };
};

export class CyberRiskQuantificationService {
  async getEnterpriseRisk(organizationId: string, budgetInr = INR_CRORE) {
    const assets = await loadRiskAssets(organizationId);
    const rows = assets.map(assetRiskRow).sort((a, b) => b.expectedAnnualLossInr - a.expectedAnnualLossInr);

    const totalFinancialExposureInr = rows.reduce((sum, row) => sum + row.impactInr, 0);
    const expectedAnnualLossInr = rows.reduce((sum, row) => sum + row.expectedAnnualLossInr, 0);
    const valueAtRisk95Inr = rows.reduce((sum, row) => sum + row.valueAtRisk95Inr, 0);
    const averageLikelihood = rows.length
      ? rows.reduce((sum, row) => sum + row.annualLikelihood, 0) / rows.length
      : 0;
    const controlEffectiveness = rows.length
      ? rows.reduce((sum, row) => sum + row.controlEffectiveness, 0) / rows.length
      : 0;

    const recommendations = buildRecommendations(rows, assets);
    const optimization = optimizeRecommendations(recommendations, budgetInr);

    const scenarios = (Object.keys(scenarioPresets) as ScenarioType[])
      .slice(0, 3)
      .map((type) => modelScenario(type, expectedAnnualLossInr, assets, budgetInr));

    return {
      computedAt: new Date().toISOString(),
      totals: {
        assets: rows.length,
        totalFinancialExposureInr,
        expectedAnnualLossInr,
        valueAtRisk95Inr,
        averageLikelihood,
        controlEffectiveness,
      },
      topRiskDrivers: rows.slice(0, 8),
      recommendations: recommendations.slice(0, 12),
      optimization,
      scenarios,
      assumptions: {
        model: 'Deterministic FAIR-inspired expected loss model v0.1',
        formula: 'EAL = annual incident likelihood x modeled business impact',
        likelihoodInputs: ['CVSS', 'EPSS', 'exploit availability', 'asset exposure', 'telemetry signals', 'control effectiveness'],
        impactInputs: ['downtime cost', 'breach cost', 'recovery cost', 'regulatory exposure', 'reputation cost'],
        note: 'LLMs explain and summarize these outputs; they do not calculate the financial exposure.',
      },
    };
  }

  async persistSnapshot(organizationId: string, budgetInr = INR_CRORE) {
    const risk = await this.getEnterpriseRisk(organizationId, budgetInr);
    return prisma.riskSnapshot.create({
      data: {
        organizationId,
        totalFinancialExposureInr: roundInr(risk.totals.totalFinancialExposureInr),
        expectedAnnualLossInr: roundInr(risk.totals.expectedAnnualLossInr),
        valueAtRisk95Inr: roundInr(risk.totals.valueAtRisk95Inr),
        averageLikelihood: risk.totals.averageLikelihood,
        controlEffectiveness: risk.totals.controlEffectiveness,
        topDrivers: risk.topRiskDrivers as any,
        assumptions: risk.assumptions as any,
      },
    });
  }

  async simulateScenario(
    organizationId: string,
    input: { type: string; budgetInr?: number; persist?: boolean; createdById?: string },
  ) {
    const scenarioType = isScenarioType(input.type) ? input.type : 'MFA_PRIVILEGED_USERS';
    const assets = await loadRiskAssets(organizationId);
    const rows = assets.map(assetRiskRow);
    const baselineEalInr = rows.reduce((sum, row) => sum + row.expectedAnnualLossInr, 0);
    const scenario = modelScenario(scenarioType, baselineEalInr, assets, input.budgetInr);

    if (!input.persist) {
      return { ...scenario, id: null, createdAt: new Date().toISOString() };
    }

    const saved = await prisma.riskScenario.create({
      data: {
        organizationId,
        name: scenario.name,
        type: scenario.type,
        budgetInr: roundInr(scenario.budgetInr),
        baselineEalInr: roundInr(scenario.baselineEalInr),
        simulatedEalInr: roundInr(scenario.simulatedEalInr),
        riskReductionInr: roundInr(scenario.riskReductionInr),
        implementationCostInr: roundInr(scenario.implementationCostInr),
        rosi: scenario.rosi,
        modeledChanges: scenario.modeledChanges as any,
        createdById: input.createdById,
      },
    });

    return {
      ...scenario,
      id: saved.id,
      createdAt: saved.createdAt.toISOString(),
    };
  }
}

export const cyberRiskQuantificationService = new CyberRiskQuantificationService();
