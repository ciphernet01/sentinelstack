'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Assessment, Finding, Severity } from '@prisma/client';
import { Copy, FileText, Loader2, Shield, ShieldAlert, ShieldCheck, ShieldHalf, Star } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { AISummaryButton } from './AISummaryButton';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { getSeverityCounts } from '@/services/riskScoring.service';
import { DEFAULT_SCANNER_TIMEOUT_MS } from '@/shared/scannerDefaults';
import {
  coerceJsonObject as coerceEvidenceObject,
  hasLegacyTimeoutEvidence,
  isScannerTimeoutTitle,
  isScannerTool,
} from '@/shared/scannerFindings';

// Some environments may have an older generated Prisma client type.
// Keep these fields optional here to avoid front-end type breakage.
type AssessmentWithIntegrity = {
  endedEarly?: boolean;
  endedEarlyReason?: string | null;
};

type AssessmentWithDetails = Assessment & AssessmentWithIntegrity & { findings: Finding[] };

type AssessmentDetailsProps = {
  assessment: AssessmentWithDetails;
  showOnboardingCta?: boolean;
};

const severityIcons: Record<Severity, React.ReactNode> = {
  CRITICAL: <ShieldAlert className="h-5 w-5 text-red-500" />,
  HIGH: <ShieldHalf className="h-5 w-5 text-orange-500" />,
  MEDIUM: <ShieldCheck className="h-5 w-5 text-yellow-500" />,
  LOW: <Shield className="h-5 w-5 text-blue-500" />,
  INFO: <Shield className="h-5 w-5 text-gray-500" />,
};

const severityColors: Record<Severity, string> = {
  CRITICAL: 'hsl(var(--chart-5))',
  HIGH: 'hsl(var(--chart-4))',
  MEDIUM: 'hsl(var(--chart-3))',
  LOW: 'hsl(var(--chart-2))',
  INFO: 'hsl(var(--muted-foreground))',
};

const getRiskScoreColor = (score: number) => {
    if (score > 80) return "text-red-500";
    if (score > 60) return "text-orange-500";
    if (score > 40) return "text-yellow-500";
    return "text-green-500";
};

const getStatusBadgeVariant = (status: Assessment['status']) => {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'IN_PROGRESS':
      return 'secondary';
    case 'PENDING':
      return 'outline';
    case 'REJECTED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const severityRank: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

const findingKey = (finding: Pick<Finding, 'toolName' | 'title'>) =>
  `${String(finding.toolName).toLowerCase()}::${String(finding.title).toLowerCase()}`;

function getNormalizedTimeoutFinding(finding: Finding) {
  if (!isScannerTool(finding.toolName)) return null;

  const evidenceObj = coerceEvidenceObject(finding.evidence);

  const looksLikeTimeout =
    isScannerTimeoutTitle(finding.title) || hasLegacyTimeoutEvidence(finding.evidence);

  if (!looksLikeTimeout) return null;

  const timeoutMs = Number(evidenceObj?.timeoutMs);
  const timeoutSource =
    typeof evidenceObj?.timeoutSource === 'string'
      ? String(evidenceObj.timeoutSource)
      : Number.isFinite(timeoutMs) && timeoutMs !== DEFAULT_SCANNER_TIMEOUT_MS
        ? 'SCANNER_TIMEOUT_MS'
        : 'default';

  const seconds = Number.isFinite(timeoutMs) ? Math.max(1, Math.round(timeoutMs / 1000)) : null;

  return {
    title: 'Scan reached time limit (results may be incomplete)',
    description: seconds
      ? `This run stopped after ${seconds}s due to the configured time limit (${timeoutSource}). Some tools may not have finished, so results may be incomplete.`
      : `This run stopped due to the configured time limit. Some tools may not have finished, so results may be incomplete.`,
    remediation:
      'If you want deeper coverage, rerun with a longer timeout (set SCANNER_TIMEOUT_MS) and/or choose a deeper preset.',
    evidence: {
      ...(evidenceObj ?? {}),
      ...(Number.isFinite(timeoutMs) ? { timeoutMs } : {}),
      timeoutSource,
    },
  };
}

function summarizeImpact(description: string, maxLen: number = 140) {
  const normalized = String(description || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Review the finding details to understand exposure and impact.';
  if (normalized.length <= maxLen) return normalized;
  const clipped = normalized.slice(0, maxLen);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(0, lastSpace)).trim()}…`;
}

export function AssessmentDetails({ assessment, showOnboardingCta }: AssessmentDetailsProps) {
  const { findings, riskScore } = assessment;
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedFindingRaw = searchParams.get('finding');

  const highlightedFindingId = useMemo(() => {
    const raw = String(requestedFindingRaw ?? '').trim();
    if (!raw) return null;
    const decoded = (() => {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    })();

    const byId = (findings ?? []).find((f) => f.id === decoded);
    if (byId) return byId.id;

    const needle = decoded.toLowerCase();
    const byKey = (findings ?? []).find((f) => findingKey(f) === needle);
    return byKey?.id ?? null;
  }, [findings, requestedFindingRaw]);

  const [tab, setTab] = useState<'summary' | 'findings'>('summary');
  const [openFindingId, setOpenFindingId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (requestedTab === 'findings' || highlightedFindingId) {
      setTab('findings');
    }
  }, [requestedTab, highlightedFindingId]);

  useEffect(() => {
    if (!highlightedFindingId) return;
    setOpenFindingId(highlightedFindingId);

    const id = highlightedFindingId;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`finding-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);

    return () => window.clearTimeout(t);
  }, [highlightedFindingId]);

  const summary = getSeverityCounts(findings);
  const isRunning = assessment.status === 'IN_PROGRESS' || assessment.status === 'PENDING';
  const canGenerateReport = assessment.status === 'COMPLETED';

  const topIssues = [...findings]
    .filter((f) => f.severity !== 'INFO')
    .sort((a, b) => {
      const bySeverity = severityRank[a.severity] - severityRank[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 5);
  
  const pieData = summary ? [
    { name: 'Critical', value: summary.CRITICAL, fill: severityColors.CRITICAL },
    { name: 'High', value: summary.HIGH, fill: severityColors.HIGH },
    { name: 'Medium', value: summary.MEDIUM, fill: severityColors.MEDIUM },
    { name: 'Low', value: summary.LOW, fill: severityColors.LOW },
  ].filter(d => d.value > 0) : [];

  const chartConfig = {
    critical: { label: 'Critical', color: severityColors.CRITICAL },
    high: { label: 'High', color: severityColors.HIGH },
    medium: { label: 'Medium', color: severityColors.MEDIUM },
    low: { label: 'Low', color: severityColors.LOW },
  };

  return (
    <>
      {showOnboardingCta && (
        <div className="mb-4 rounded-lg border border-dashed bg-card p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Onboarding: watch it run</div>
              <div className="text-sm text-muted-foreground mt-1">
                Keep this page open. When the status becomes <span className="font-medium">COMPLETED</span>, click <span className="font-medium">Generate Report</span>.
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Tip: the page auto-refreshes while running.</div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl font-headline">{assessment.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Target: {assessment.targetUrl}</p>
            <Badge
              variant={getStatusBadgeVariant(assessment.status)}
              className={assessment.status === 'IN_PROGRESS' ? 'animate-pulse' : undefined}
            >
              {assessment.status === 'IN_PROGRESS' && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {assessment.status}
            </Badge>
            {assessment.endedEarly ? (
              <Badge variant="secondary" className="bg-sky-500/15 text-sky-200 border border-sky-500/25">
                Partial results
              </Badge>
            ) : null}
          </div>
          {assessment.endedEarly ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Notice: this scan ended early{assessment.endedEarlyReason ? ` (${assessment.endedEarlyReason})` : ''}. Results may be incomplete.
            </p>
          ) : null}
          {isRunning && (
            <p className="mt-2 text-sm text-muted-foreground">
              This assessment is running. Results will update automatically.
            </p>
          )}
        </div>
        <div className="flex gap-2">
            <AISummaryButton findings={JSON.stringify(findings, null, 2)} />
            <Button asChild disabled={!canGenerateReport}>
              <Link href={`/dashboard/report/${assessment.id}`} target="_blank" aria-disabled={!canGenerateReport}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Link>
            </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Top 5 Issues</CardTitle>
              <CardDescription>
                Quick, high-signal summary of the most important items to fix first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topIssues.length === 0 ? (
                <div className="text-sm text-muted-foreground">No High-impact issues found yet.</div>
              ) : (
                <div className="space-y-3">
                  {topIssues.map((f) => (
                    <div key={f.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{f.title}</div>
                        <Badge variant="secondary">{f.severity}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">Impact: {summarizeImpact(f.description)}</div>
                      <div className="mt-2 text-xs text-muted-foreground">Fix: {summarizeImpact(f.remediation, 160)}</div>
                    </div>
                  ))}
                </div>
              )}
              {!canGenerateReport && (
                <div className="mt-4 text-xs text-muted-foreground">
                  PDF export unlocks when the assessment reaches COMPLETED.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${getRiskScoreColor(riskScore ?? 0)}`}>
                        {riskScore ?? 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">Overall risk rating</p>
                </CardContent>
            </Card>
            {summary && (Object.keys(summary) as Severity[]).filter(key => key !== 'INFO').map((severity) => (
              <Card key={severity}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">{severity.toLowerCase()}</CardTitle>
                  {severityIcons[severity]}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary[severity]}</div>
                  <p className="text-xs text-muted-foreground">findings</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="mt-4">
              <CardHeader>
                  <CardTitle>Findings Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center pt-6">
                  <ChartContainer config={chartConfig} className="aspect-square w-full max-w-[250px]">
                      <PieChart>
                          <ChartTooltipContent hideLabel />
                          <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              innerRadius={70}
                              strokeWidth={2}
                              labelLine={false}
                          >
                                {pieData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.fill} stroke={entry.fill} />
                                ))}
                          </Pie>
                          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                      </PieChart>
                  </ChartContainer>
              </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="findings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Findings</CardTitle>
              <CardDescription>
                Detailed list of all vulnerabilities and misconfigurations found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion
                type="single"
                collapsible
                className="w-full"
                value={openFindingId}
                onValueChange={(v) => setOpenFindingId(v || undefined)}
              >
                {findings.map((finding) => (
                  <FindingItem
                    key={finding.id}
                    finding={finding}
                    highlighted={finding.id === highlightedFindingId}
                  />
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function FindingItem({ finding, highlighted }: { finding: Finding; highlighted?: boolean }) {
  const normalized = getNormalizedTimeoutFinding(finding);
  const title = normalized?.title ?? finding.title;
  const description = normalized?.description ?? finding.description;
  const remediation = normalized?.remediation ?? finding.remediation;
  const evidence = normalized?.evidence ?? finding.evidence;
  const isNotice = Boolean(normalized);
  const compliance = Array.isArray(finding.complianceMapping) ? finding.complianceMapping : [];
  const [copied, setCopied] = useState(false);

  const handleCopyEvidence = async () => {
    try {
      const text = JSON.stringify(evidence, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <AccordionItem
      value={finding.id}
      id={`finding-${finding.id}`}
      className={
        highlighted
          ? 'deeplink-pulse rounded-md border border-primary/40 bg-muted/20'
          : isNotice
            ? 'rounded-md border border-sky-500/30 bg-sky-500/5'
            : undefined
      }
    >
      <AccordionTrigger className={`hover:no-underline ${highlighted ? 'text-primary' : ''}`}>
        <div className="flex items-center gap-4 text-left w-full">
          {severityIcons[finding.severity]}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold truncate">{title}</p>
              {isNotice && (
                <Badge variant="secondary" className="shrink-0 bg-sky-500/15 text-sky-200 border border-sky-500/25">
                  Notice
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Found by: {finding.toolName}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pl-12">
        <p className="text-sm">{description}</p>
        <div>
            <h4 className="font-semibold text-sm mb-1">Remediation</h4>
            <p className="text-sm text-muted-foreground">{remediation}</p>
        </div>
        <div>
            <h4 className="font-semibold text-sm mb-1">Compliance</h4>
            {compliance.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                  {compliance.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No compliance mappings</p>
            )}
        </div>
        <Accordion type="single" collapsible>
            <AccordionItem value="evidence">
                <AccordionTrigger className="text-sm">View Evidence</AccordionTrigger>
                <AccordionContent>
                    <div className="flex justify-end pb-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyEvidence}
                        disabled={copied}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="bg-secondary p-4 rounded-md text-xs overflow-x-auto font-code">
                        {JSON.stringify(evidence, null, 2)}
                    </pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  );
}
