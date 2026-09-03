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
