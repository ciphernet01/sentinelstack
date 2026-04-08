import type { Finding } from '@prisma/client';

export type ScanFindingSignature = {
  toolName: string;
  title: string;
  severity: string;
};

export type ScanFindingSummary = ScanFindingSignature & {
  id?: string;
  description?: string;
};

export type ScanDiffSummary = {
  baselineAssessmentId: string | null;
  baselineCompletedAt: string | null;
  baselineFindingCount: number;
  currentFindingCount: number;
  newFindingCount: number;
  resolvedFindingCount: number;
  unchangedFindingCount: number;
  newFindings: ScanFindingSummary[];
  resolvedFindings: ScanFindingSummary[];
};

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

export const buildFindingSignature = (finding: Pick<Finding, 'toolName' | 'title' | 'severity'>): string => {
  return [normalize(finding.toolName), normalize(finding.title), normalize(finding.severity)].join('::');
};

const toSummary = (finding: Pick<Finding, 'id' | 'toolName' | 'title' | 'severity' | 'description'>): ScanFindingSummary => ({
  id: finding.id,
  toolName: String(finding.toolName),
  title: String(finding.title),
  severity: String(finding.severity),
  description: String(finding.description),
});

export const computeScanDiffSummary = (
  currentFindings: Finding[],
  previousAssessment: {
    id: string;
    completedAt: Date | string | null;
    findings: Finding[];
  } | null,
  sampleLimit = 10,
): ScanDiffSummary | null => {
  if (!previousAssessment) {
    return null;
  }

  const currentMap = new Map<string, Finding>();
  for (const finding of currentFindings) {
    currentMap.set(buildFindingSignature(finding), finding);
  }

  const previousMap = new Map<string, Finding>();
  for (const finding of previousAssessment.findings || []) {
    previousMap.set(buildFindingSignature(finding), finding);
  }

  const newFindings = currentFindings
    .filter((finding) => !previousMap.has(buildFindingSignature(finding)))
    .slice(0, sampleLimit)
    .map(toSummary);

  const resolvedFindings = (previousAssessment.findings || [])
    .filter((finding) => !currentMap.has(buildFindingSignature(finding)))
    .slice(0, sampleLimit)
    .map(toSummary);

  const baselineFindingCount = previousAssessment.findings?.length || 0;
  const currentFindingCount = currentFindings.length;
  const newFindingCount = currentFindings.filter((finding) => !previousMap.has(buildFindingSignature(finding))).length;
  const resolvedFindingCount = (previousAssessment.findings || []).filter(
    (finding) => !currentMap.has(buildFindingSignature(finding)),
  ).length;

  return {
    baselineAssessmentId: previousAssessment.id,
    baselineCompletedAt:
      previousAssessment.completedAt instanceof Date
        ? previousAssessment.completedAt.toISOString()
        : previousAssessment.completedAt || null,
    baselineFindingCount,
    currentFindingCount,
    newFindingCount,
    resolvedFindingCount,
    unchangedFindingCount: Math.max(0, currentFindingCount - newFindingCount),
    newFindings,
    resolvedFindings,
  };
};