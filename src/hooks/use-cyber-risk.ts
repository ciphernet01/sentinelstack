'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export type RiskDriver = {
  assetId: string;
  externalAssetId: string;
  hostname: string;
  serviceName: string;
  businessUnit: string;
  criticality: string;
  internetExposed: boolean;
  impactInr: number;
  annualLikelihood: number;
  expectedAnnualLossInr: number;
  valueAtRisk95Inr: number;
  controlEffectiveness: number;
  openVulnerabilities: number;
  exploitableVulnerabilities: number;
  topVulnerabilities: Array<{
    id: string;
    cve: string | null;
    title: string;
    cvss: number;
    epss: number;
    exploitAvailable: boolean;
    patchAvailable: boolean;
  }>;
};

export type RiskRecommendation = {
  id: string;
  title: string;
  assetId: string;
  serviceName: string;
  costInr: number;
  estimatedEalReductionInr: number;
  category: string;
};

export type RiskScenario = {
  name: string;
  type: string;
  baselineEalInr: number;
  simulatedEalInr: number;
  riskReductionInr: number;
  implementationCostInr: number;
  rosi: number;
};

export type CyberRiskResponse = {
  computedAt: string;
  totals: {
    assets: number;
    totalFinancialExposureInr: number;
    expectedAnnualLossInr: number;
    valueAtRisk95Inr: number;
    averageLikelihood: number;
    controlEffectiveness: number;
  };
  topRiskDrivers: RiskDriver[];
  recommendations: RiskRecommendation[];
  optimization: {
    budgetInr: number;
    selected: RiskRecommendation[];
    spendInr: number;
    estimatedRiskReductionInr: number;
    rosi: number;
  };
  scenarios: RiskScenario[];
  assumptions: {
    model: string;
    formula: string;
    likelihoodInputs: string[];
    impactInputs: string[];
    note: string;
  };
};

/**
 * P3 normalized risk driver, as returned by `GET /api/v1/risk/drivers`.
 *
 * This is a *factor*, not an asset. `contributionToEal` is a modelled
 * contribution to expected annual loss, not a realised or guaranteed loss, and
 * the UI must be worded accordingly (P3 spec §47).
 */
export type NormalizedRiskDriver = {
  id: string;
  riskAssessmentId: string;
  riskRunId: string;
  driverKey: string;
  type: string;
  entityType: string;
  entityId: string;
  name: string;
  attributionMethod: string;
  attributionVersion: string;
  /** Modelled rupee contribution to expected annual loss. */
  contributionToEal: number | null;
  /** null means "this attribution method does not support this metric". */
  contributionToVar95: number | null;
  contributionToVar99: number | null;
  /** 0-100 index points. Never comparable with the rupee figures above. */
  contributionToRiskScore: number | null;
  direction: 'INCREASES_RISK' | 'REDUCES_RISK' | 'LIMITS_CONFIDENCE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  reviewStatus: 'UNREVIEWED' | 'REVIEWED' | 'DISPUTED' | 'ACCEPTED' | 'REJECTED';
  rank: number;
  attributionHash: string | null;
  evidenceCount: number;
  createdAt: string;
};

export type RiskDriversResponse = {
  data: NormalizedRiskDriver[];
  meta: { count: number };
};

/**
 * P3 driver attribution.
 *
 * Kept separate from `useCyberRisk`: the legacy enterprise endpoint and the
 * normalized driver list are different resources with different failure modes,
 * and one failing must not blank the other's panel.
 */
export function useRiskDrivers(limit = 5) {
  return useQuery<NormalizedRiskDriver[], Error>({
    queryKey: ['riskDrivers', limit],
    queryFn: async () => {
      const response = await api.get<RiskDriversResponse>('/v1/risk/drivers', {
        params: { limit },
      });
      return response.data.data ?? [];
    },
    // Drivers are only produced by a completed calculation; there is nothing to
    // retry for until one has run.
    retry: false,
  });
}

export function useCyberRisk(budgetInr = 10_000_000) {
  return useQuery<CyberRiskResponse, Error>({
    queryKey: ['cyberRiskEnterprise', budgetInr],
    queryFn: async () => {
      const response = await api.get('/cyber-risk/enterprise', {
        params: { budgetInr },
      });
      return response.data;
    },
    retry: false,
  });
}
