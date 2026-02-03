'use client';

import Link from 'next/link';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ArrowDownRight, ArrowUpRight, Download, FileText, Calendar } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SeverityDistribution = Record<string, number>;

type SeverityOverTimeRow = {
  name: string;
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  INFO: number;
};

type RecentHighRiskAssessment = {
  id: string;
  name: string;
  targetUrl: string;
  riskScore: number;
  createdAt: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
};

type AnalyticsResponse = {
  stats: {
    totalAssessments: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    overallRiskScore: number;
    deltas?: {
      overallRiskScore: number;
      criticalCount: number;
      highCount: number;
      totalAssessments: number;
    };
  };
  findingsOverTime: Array<{ name: string; total: number }>;
  latestAssessmentComparison?: null | {
    latest: {
      id: string;
      name: string;
      targetUrl: string;
      createdAt: string;
      riskScore: number;
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      infoCount: number;
    };
    previous: null | {
      id: string;
      name: string;
      targetUrl: string;
      createdAt: string;
      riskScore: number;
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      infoCount: number;
    };
    delta: {
      riskScore: number;
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      infoCount: number;
    };
    topNewFindings: Array<{ toolName: string; title: string; severity: string }>;
    topResolvedFindings: Array<{ toolName: string; title: string; severity: string }>;
    regressions?: null | {
      newCriticalCount: number;
      newHighCount: number;
      topNewSevereFindings: Array<{ toolName: string; title: string; severity: string }>;
    };
  };
  severityOverTime: SeverityOverTimeRow[];
  riskScoreOverTime: Array<{ name: string; avgRiskScore: number }>;
  severityDistribution: SeverityDistribution;
  topTools: Array<{ toolName: string; total: number; CRITICAL: number; HIGH: number; MEDIUM: number }>;
  topTargets: Array<{ targetUrl: string; avgRiskScore: number; assessments: number }>;
  recentHighRiskAssessments: RecentHighRiskAssessment[];

  mttr?: null | {
    windowDays: number;
    latestAssessmentId: string;
    bySeverity: Array<{
      severity: string;
      resolvedCount: number;
      openCount: number;
      avgResolvedDays: number;
      medianResolvedDays: number;
      avgOpenAgeDays: number;
    }>;
  };

  remediationPlan?: Array<{
    toolName: string;
    title: string;
    severity: string;
    occurrencesLast90d: number;
    lastSeenAt: string;
    lastSeenAssessmentId: string;
    remediationPreview: string;
  }>;
  coverageGaps?: {
    staleThresholdDays: number;
    staleTargets: Array<{
      targetUrl: string;
      daysSinceLastCompleted: number;
      lastCompletedAt: string;
      lastAssessmentId: string;
      lastRiskScore: number | null;
    }>;
    neverCompletedTargets: Array<{
      targetUrl: string;
      lastAttemptAt: string;
      lastAssessmentId: string;
      lastAttemptStatus: string;
    }>;
  };
};

const chartColors = {
  cyan: '#00E5FF',
  magenta: '#E91E63',
  purple: '#9C27B0',
  blue: '#2196F3',
  teal: '#1DE9B6',
  violet: '#7C4DFF',
} as const;

const severityColors: Record<string, string> = {
  CRITICAL: '#E91E63',
  HIGH: '#FF6B35',
  MEDIUM: '#FFA726',
  LOW: '#1DE9B6',
  INFO: '#64B5F6',
};

function GradientStops({ color }: { color: string }) {
  return (
    <>
      <stop offset="0%" stopColor={color} stopOpacity={0.9} />
      <stop offset="55%" stopColor={color} stopOpacity={0.7} />
      <stop offset="100%" stopColor={color} stopOpacity={0.48} />
    </>
  );
}

const findingKey = (toolName: string, title: string) =>
  `${String(toolName).toLowerCase()}::${String(title).toLowerCase()}`;

function formatPercent(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function Delta({ value, kind, label = 'last 30d' }: { value: number; kind: 'percent' | 'count'; label?: string }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  const text = kind === 'percent' ? formatPercent(value) : `${value > 0 ? '+' : ''}${value}`;

  const className = isPositive
    ? 'text-primary'
    : isNegative
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <div className={`mt-2 flex items-center gap-1 text-xs ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums">{text}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  delta,
  deltaKind,
  deltaLabel = 'last 30d',
}: {
  title: string;
  value: string | number;
  delta?: number;
  deltaKind?: 'percent' | 'count';
  deltaLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {typeof delta === 'number' && deltaKind ? <Delta value={delta} kind={deltaKind} label={deltaLabel} /> : null}
      </CardContent>
    </Card>
  );
}

function formatSigned(value: number) {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${value}`;
}

// Risk Score Gauge Component
function RiskScoreGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const rotation = (clampedScore / 100) * 180 - 90; // -90 to 90 degrees
  
  // Color based on score
  const getColor = (s: number) => {
    if (s <= 30) return '#22c55e'; // green
    if (s <= 60) return '#eab308'; // yellow
    if (s <= 80) return '#f97316'; // orange
    return '#ef4444'; // red
  };
  
  const getRiskLabel = (s: number) => {
    if (s <= 30) return 'Low Risk';
    if (s <= 60) return 'Medium Risk';
    if (s <= 80) return 'High Risk';
    return 'Critical Risk';
  };

  const color = getColor(clampedScore);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Background arc */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="30%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          {/* Background track */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Colored progress arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(clampedScore / 100) * 251.2} 251.2`}
          />
        </svg>
        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-16 origin-bottom transition-transform duration-700 ease-out"
          style={{ 
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            background: `linear-gradient(to top, ${color}, ${color}88)`
          }}
        >
          <div 
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full bg-background border-2 border-muted" />
      </div>
      {/* Score display */}
      <div className="mt-2 text-center">
        <div className="text-4xl font-bold tabular-nums" style={{ color }}>{clampedScore}</div>
        <div className="text-sm text-muted-foreground">{getRiskLabel(clampedScore)}</div>
      </div>
      {/* Scale labels */}
      <div className="flex justify-between w-48 mt-1 text-xs text-muted-foreground">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

// Export functions
function exportToCSV(data: AnalyticsResponse) {
  const rows: string[] = [];
  
  // Stats
  rows.push('=== Risk Analytics Summary ===');
  rows.push(`Overall Risk Score,${data.stats?.overallRiskScore ?? 0}`);
  rows.push(`Total Assessments,${data.stats?.totalAssessments ?? 0}`);
  rows.push(`Total Findings,${data.stats?.totalFindings ?? 0}`);
  rows.push(`Critical Findings,${data.stats?.criticalCount ?? 0}`);
  rows.push(`High Findings,${data.stats?.highCount ?? 0}`);
  rows.push(`Medium Findings,${data.stats?.mediumCount ?? 0}`);
  rows.push('');
  
  // Severity Distribution
  rows.push('=== Severity Distribution ===');
  rows.push('Severity,Count');
  Object.entries(data.severityDistribution ?? {}).forEach(([sev, count]) => {
    rows.push(`${sev},${count}`);
  });
  rows.push('');
  
  // Top Tools
  rows.push('=== Top Tools ===');
  rows.push('Tool,Total,Critical,High,Medium');
  (data.topTools ?? []).forEach(t => {
    rows.push(`${t.toolName},${t.total},${t.CRITICAL},${t.HIGH},${t.MEDIUM}`);
  });
  rows.push('');
  
  // Top Targets
  rows.push('=== Top Targets ===');
  rows.push('Target URL,Avg Risk Score,Assessments');
  (data.topTargets ?? []).forEach(t => {
    rows.push(`"${t.targetUrl}",${t.avgRiskScore},${t.assessments}`);
  });
  rows.push('');
  
  // Recent High Risk
  rows.push('=== Recent High Risk Assessments ===');
  rows.push('Target,Risk Score,Total Findings,Critical,High,Medium,Date');
  (data.recentHighRiskAssessments ?? []).forEach(a => {
    rows.push(`"${a.targetUrl}",${a.riskScore},${a.totalFindings},${a.criticalCount},${a.highCount},${a.mediumCount},${new Date(a.createdAt).toLocaleDateString()}`);
  });
  
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `risk-analytics-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(data: AnalyticsResponse) {
  // Create a printable HTML document
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Risk Analytics Report - ${new Date().toLocaleDateString()}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
        h2 { color: #4f46e5; margin-top: 30px; }
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; color: #1a1a2e; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: 600; }
        .critical { color: #dc2626; font-weight: 600; }
        .high { color: #ea580c; font-weight: 600; }
        .medium { color: #ca8a04; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>🛡️ Risk Analytics Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${data.stats?.overallRiskScore ?? 0}</div>
          <div class="stat-label">Overall Risk Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.stats?.totalAssessments ?? 0}</div>
          <div class="stat-label">Total Assessments</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.stats?.totalFindings ?? 0}</div>
          <div class="stat-label">Total Findings</div>
        </div>
      </div>
      
      <h2>Severity Distribution</h2>
      <table>
        <tr><th>Severity</th><th>Count</th></tr>
        ${Object.entries(data.severityDistribution ?? {}).map(([sev, count]) => 
          `<tr><td class="${sev.toLowerCase()}">${sev}</td><td>${count}</td></tr>`
        ).join('')}
      </table>
      
      <h2>Top Risky Targets</h2>
      <table>
        <tr><th>Target</th><th>Avg Risk Score</th><th>Assessments</th></tr>
        ${(data.topTargets ?? []).slice(0, 10).map(t => 
          `<tr><td>${t.targetUrl}</td><td>${t.avgRiskScore}</td><td>${t.assessments}</td></tr>`
        ).join('')}
      </table>
      
      <h2>Recent High-Risk Assessments</h2>
      <table>
        <tr><th>Target</th><th>Risk</th><th>Critical</th><th>High</th><th>Date</th></tr>
        ${(data.recentHighRiskAssessments ?? []).slice(0, 10).map(a => 
          `<tr><td>${a.targetUrl}</td><td>${a.riskScore}</td><td class="critical">${a.criticalCount}</td><td class="high">${a.highCount}</td><td>${new Date(a.createdAt).toLocaleDateString()}</td></tr>`
        ).join('')}
      </table>
      
      <div class="footer">
        <p>Report generated by SentinelStack Security Platform</p>
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  }
}

export default function RiskAnalyticsView({ 
  data, 
  dateRange = '30',
  onDateRangeChange 
}: { 
  data: AnalyticsResponse;
  dateRange?: string;
  onDateRangeChange?: (range: string) => void;
}) {
  const severityRows = Object.entries(data.severityDistribution ?? {})
    .map(([severity, count]) => ({ severity, count }));

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  severityRows.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  const topTargets = data.topTargets ?? [];
  const recent = data.recentHighRiskAssessments ?? [];
  const compare = data.latestAssessmentComparison ?? null;
  const regressions = compare?.regressions ?? null;
  const remediationPlan = data.remediationPlan ?? [];
  const coverageGaps = data.coverageGaps ?? null;
  const mttr = data.mttr ?? null;
  
  const dateRangeLabel = {
    '7': 'last 7d',
    '30': 'last 30d',
    '90': 'last 90d',
    '180': 'last 6mo',
    '365': 'last 12mo',
  }[dateRange] ?? 'last 30d';

  return (
    <div className="space-y-8">
      {/* Header with Gauge, Filters and Export */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        {/* Risk Score Gauge */}
        <Card className="w-full lg:w-auto">
          <CardContent className="pt-6">
            <RiskScoreGauge score={data.stats?.overallRiskScore ?? 0} />
          </CardContent>
        </Card>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(val) => onDateRangeChange?.(val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCSV(data)} className="gap-2">
                <FileText className="h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF(data)} className="gap-2">
                <FileText className="h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Assessments"
          value={data.stats?.totalAssessments ?? 0}
          delta={data.stats?.deltas?.totalAssessments}
          deltaKind="count"
          deltaLabel={dateRangeLabel}
        />
        <StatCard
          title="Critical Findings"
          value={data.stats?.criticalCount ?? 0}
          delta={data.stats?.deltas?.criticalCount}
          deltaKind="percent"
          deltaLabel={dateRangeLabel}
        />
        <StatCard
          title="High Findings"
          value={data.stats?.highCount ?? 0}
          delta={data.stats?.deltas?.highCount}
          deltaKind="percent"
          deltaLabel={dateRangeLabel}
        />
        <StatCard title="Total Findings" value={data.stats?.totalFindings ?? 0} />
      </div>

      {compare?.latest ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Why Your Score Changed</CardTitle>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/assessments/${compare.latest.id}`}>View latest</Link>
                  </Button>
                  {compare.previous ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/assessments/${compare.previous.id}`}>View previous</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {compare.previous && regressions && (regressions.newCriticalCount > 0 || regressions.newHighCount > 0) ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-destructive">Regressions detected</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        New Critical: <span className="font-medium tabular-nums">{regressions.newCriticalCount}</span>, New High:{' '}
                        <span className="font-medium tabular-nums">{regressions.newHighCount}</span> (vs previous run)
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/assessments/${compare.latest.id}`}>Review</Link>
                    </Button>
                  </div>

                  {regressions.topNewSevereFindings.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {regressions.topNewSevereFindings.map((f, idx) => (
                        <div key={`${f.toolName}-${idx}`} className="rounded-md border bg-background/60 p-2">
                          <div className="text-xs text-muted-foreground">{f.severity} · {f.toolName}</div>
                          <div className="text-sm font-medium">
                            <Link
                              className="underline underline-offset-4"
                              href={`/dashboard/assessments/${compare.latest.id}?tab=findings&finding=${encodeURIComponent(
                                findingKey(f.toolName, f.title)
                              )}`}
                            >
                              {f.title}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {compare.previous ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Risk score change</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{formatSigned(compare.delta.riskScore)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <Link className="underline underline-offset-4" href={`/dashboard/assessments/${compare.previous.id}`}>
                        {compare.previous.name}
                      </Link>{' '}
                      →{' '}
                      <Link className="underline underline-offset-4" href={`/dashboard/assessments/${compare.latest.id}`}>
                        {compare.latest.name}
                      </Link>
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Findings change</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{formatSigned(compare.delta.totalFindings)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Critical {formatSigned(compare.delta.criticalCount)}, High {formatSigned(compare.delta.highCount)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Run at least two assessments to see deltas and drivers.
                </div>
              )}

              {compare.previous ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold">New in latest run</div>
                    <div className="mt-2 space-y-2">
                      {(compare.topNewFindings ?? []).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No newly detected findings.</div>
                      ) : (
                        (compare.topNewFindings ?? []).map((f, idx) => (
                          <div key={`${f.toolName}-${idx}`} className="rounded-md border p-2">
                            <div className="text-xs text-muted-foreground">{f.severity} · {f.toolName}</div>
                            <div className="text-sm font-medium">
                              <Link
                                className="underline underline-offset-4"
                                href={`/dashboard/assessments/${compare.latest.id}?tab=findings&finding=${encodeURIComponent(
                                  findingKey(f.toolName, f.title)
                                )}`}
                              >
                                {f.title}
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Resolved vs previous</div>
                    <div className="mt-2 space-y-2">
                      {(compare.topResolvedFindings ?? []).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No resolved findings detected.</div>
                      ) : (
                        (compare.topResolvedFindings ?? []).map((f, idx) => (
                          <div key={`${f.toolName}-${idx}`} className="rounded-md border p-2">
                            <div className="text-xs text-muted-foreground">{f.severity} · {f.toolName}</div>
                            <div className="text-sm font-medium">
                              {compare.previous ? (
                                <Link
                                  className="underline underline-offset-4"
                                  href={`/dashboard/assessments/${compare.previous.id}?tab=findings&finding=${encodeURIComponent(
                                    findingKey(f.toolName, f.title)
                                  )}`}
                                >
                                  {f.title}
                                </Link>
                              ) : (
                                f.title
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Latest Assessment Summary</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/assessments/${compare.latest.id}`}>Open</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Latest</div>
                <div className="mt-1 text-sm font-semibold">{compare.latest.name}</div>
                <div className="mt-1 text-xs text-muted-foreground break-words">{compare.latest.targetUrl}</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="text-[11px] text-muted-foreground">Risk</div>
                    <div className="text-base font-bold tabular-nums">{compare.latest.riskScore}</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="text-[11px] text-muted-foreground">Critical</div>
                    <div className="text-base font-bold tabular-nums">{compare.latest.criticalCount}</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="text-[11px] text-muted-foreground">High</div>
                    <div className="text-base font-bold tabular-nums">{compare.latest.highCount}</div>
                  </div>
                </div>
              </div>

              {compare.previous ? (
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Previous</div>
                  <div className="mt-1 text-sm font-semibold">
                    <Link className="underline underline-offset-4" href={`/dashboard/assessments/${compare.previous.id}`}>
                      {compare.previous.name}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground break-words">{compare.previous.targetUrl}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {remediationPlan.length > 0 || (coverageGaps && (coverageGaps.staleTargets.length > 0 || coverageGaps.neverCompletedTargets.length > 0)) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Remediation Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {remediationPlan.length === 0 ? (
                <div className="text-sm text-muted-foreground">Not enough completed data yet.</div>
              ) : (
                <div className="space-y-3">
                  {remediationPlan.map((item, idx) => (
                    <div key={`${item.toolName}-${idx}`} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">{item.severity} · {item.toolName}</div>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/dashboard/assessments/${item.lastSeenAssessmentId}?tab=findings&finding=${encodeURIComponent(
                              findingKey(item.toolName, item.title)
                            )}`}
                          >
                            View
                          </Link>
                        </Button>
                      </div>
                      <div className="mt-1 text-sm font-semibold">{item.title}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Seen {item.occurrencesLast90d}× (90d) · last {new Date(item.lastSeenAt).toLocaleDateString()}
                      </div>
                      {item.remediationPreview ? (
                        <div className="mt-2 text-xs text-muted-foreground">Fix: {item.remediationPreview}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coverage Gaps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!coverageGaps ? (
                <div className="text-sm text-muted-foreground">Not enough data yet.</div>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-semibold">Stale targets</div>
                    <div className="mt-2 space-y-2">
                      {coverageGaps.staleTargets.length === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          No stale targets (threshold: {coverageGaps.staleThresholdDays} days).
                        </div>
                      ) : (
                        coverageGaps.staleTargets.map((t) => (
                          <div key={t.targetUrl} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{t.targetUrl}</div>
                                <div className="text-xs text-muted-foreground">
                                  Last completed {t.daysSinceLastCompleted}d ago · {new Date(t.lastCompletedAt).toLocaleDateString()}
                                </div>
                              </div>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/targets?target=${encodeURIComponent(t.targetUrl)}`}>Open</Link>
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold">Never completed</div>
                    <div className="mt-2 space-y-2">
                      {coverageGaps.neverCompletedTargets.length === 0 ? (
                        <div className="text-xs text-muted-foreground">None.</div>
                      ) : (
                        coverageGaps.neverCompletedTargets.map((t) => (
                          <div key={t.targetUrl} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{t.targetUrl}</div>
                                <div className="text-xs text-muted-foreground">
                                  Last attempt: {t.lastAttemptStatus} · {new Date(t.lastAttemptAt).toLocaleDateString()}
                                </div>
                              </div>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/assessments/${t.lastAssessmentId}`}>View</Link>
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Risk Score (12 months)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.riskScoreOverTime ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" interval={1} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="avgRiskScore" stroke={chartColors.cyan} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings Volume (12 months)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.findingsOverTime ?? []}>
                <defs>
                  <linearGradient id="ra-findingsVolume-total" x1="0" y1="0" x2="0" y2="1">
                    <GradientStops color={chartColors.teal} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" interval={1} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="total" fill="url(#ra-findingsVolume-total)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>Resolution Velocity (MTTR)</CardTitle>
            {mttr?.latestAssessmentId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/assessments/${mttr.latestAssessmentId}`}>Open latest</Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!mttr || (mttr.bySeverity ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Run a few completed assessments to unlock MTTR metrics.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Window: last {mttr.windowDays} days · Resolved = present then disappears · Open age = days since first seen
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">Median days</TableHead>
                    <TableHead className="text-right">Avg days</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">Avg open age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mttr.bySeverity ?? []).map((row) => (
                    <TableRow key={row.severity}>
                      <TableCell className="font-medium">{row.severity}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.resolvedCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.medianResolvedDays}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.avgResolvedDays}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.openCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.avgOpenAgeDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityRows} layout="vertical" margin={{ left: 16 }}>
                <defs>
                  {Object.entries(severityColors).map(([severity, color]) => (
                    <linearGradient
                      key={severity}
                      id={`ra-severityDistribution-${severity}`}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <GradientStops color={color} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="severity" width={90} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {severityRows.map((row, idx) => (
                    <Cell
                      key={`${row.severity}-${idx}`}
                      fill={
                        severityColors[row.severity]
                          ? `url(#ra-severityDistribution-${row.severity})`
                          : 'hsl(var(--muted-foreground))'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Tools (by findings)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topTools ?? []} layout="vertical" margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="ra-topTools-total" x1="0" y1="0" x2="1" y2="0">
                    <GradientStops color={chartColors.violet} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="toolName" width={180} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="total" fill="url(#ra-topTools-total)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Severity Trend (12 months)</CardTitle>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.severityOverTime ?? []}>
              <defs>
                {Object.entries(severityColors).map(([severity, color]) => (
                  <linearGradient key={severity} id={`ra-severityTrend-${severity}`} x1="0" y1="0" x2="0" y2="1">
                    <GradientStops color={color} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" interval={1} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="CRITICAL" stackId="a" fill="url(#ra-severityTrend-CRITICAL)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="HIGH" stackId="a" fill="url(#ra-severityTrend-HIGH)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="MEDIUM" stackId="a" fill="url(#ra-severityTrend-MEDIUM)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="LOW" stackId="a" fill="url(#ra-severityTrend-LOW)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="INFO" stackId="a" fill="url(#ra-severityTrend-INFO)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Targets (by avg risk score)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topTargets.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed assessments with risk scores yet.</div>
            ) : (
              topTargets.map(t => (
                <div key={t.targetUrl} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      <Link
                        className="underline underline-offset-4"
                        href={`/dashboard/targets?target=${encodeURIComponent(t.targetUrl)}`}
                      >
                        {t.targetUrl}
                      </Link>
                    </div>
                    <div className="text-sm text-muted-foreground">Assessments: {t.assessments}</div>
                  </div>
                  <div className="tabular-nums font-semibold">{t.avgRiskScore}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent High-Risk Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completed assessments with risk scores yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Critical/High/Med</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="min-w-[280px]">
                      <div className="font-medium truncate">
                        <Link className="underline underline-offset-4" href={`/dashboard/assessments/${a.id}`}>
                          {a.targetUrl}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{a.name}</div>
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">{a.riskScore}</TableCell>
                    <TableCell className="tabular-nums">{a.totalFindings}</TableCell>
                    <TableCell className="tabular-nums">
                      {a.criticalCount}/{a.highCount}/{a.mediumCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/assessments/${a.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
