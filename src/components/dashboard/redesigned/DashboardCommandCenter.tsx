'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  CircleDollarSign,
  FileDown,
  Gauge,
  Globe2,
  Landmark,
  Network,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Assessment, AssessmentStatus } from '@prisma/client';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from 'next-themes';

import type { CyberRiskResponse, NormalizedRiskDriver } from '@/hooks/use-cyber-risk';
import { useRiskDrivers } from '@/hooks/use-cyber-risk';
import { SentinelGlobe } from './globe/SentinelGlobe';
import { CyberPanel, CyberPanelHeader, CyberStatusDot } from './ui/CyberPanel';

type DashboardStats = {
  overallRiskScore: number;
  totalAssessments: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  deltas: {
    overallRiskScore: number;
    criticalCount: number;
    highCount: number;
    totalAssessments: number;
  };
};

type DashboardAssessment = Assessment & { findings?: unknown[] };

type AnalyticsData = {
  severityDistribution?: Record<string, number>;
  totalFindings?: number;
};

type ScanQueueStats = {
  now: string;
  counts: Record<string, number>;
  runnableQueued: number;
  oldestQueuedAgeSeconds: number;
};

type DashboardCommandCenterProps = {
  userName?: string | null;
  stats: DashboardStats;
  recentAssessments: DashboardAssessment[];
  findingsOverTime: Array<{ name: string; total: number }>;
  cyberRisk?: CyberRiskResponse | null;
  analytics?: AnalyticsData | null;
  scanQueueStats?: ScanQueueStats | null;
  isScanQueueLoading?: boolean;
  isCyberRiskLoading?: boolean;
  onRefresh?: () => void;
};

function formatInr(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function riskColor(score: number) {
  if (score >= 80) return 'text-cc-critical';
  if (score >= 60) return 'text-amber-300';
  if (score >= 40) return 'text-yellow-200';
  return 'text-cc-success';
}

function statusClass(status: AssessmentStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'text-cc-success border-cc-success/25 bg-emerald-300/10';
    case 'IN_PROGRESS':
      return 'text-cc-cyan border-cc-cyan/25 bg-cyan-300/10';
    case 'REJECTED':
      return 'text-cc-critical border-cc-critical/25 bg-rose-300/10';
    default:
      return 'text-cc-muted border-cc-hairline/25 bg-cc-elevated';
  }
}

function Delta({
  value,
  inverted = false,
}: {
  value: number;
  inverted?: boolean;
}) {
  if (!value) {
    return <span className="text-[10px] text-cc-dim">No change</span>;
  }

  const positive = value > 0;
  const good = inverted ? !positive : positive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] ${good ? 'text-cc-success' : 'text-cc-critical'}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  delta,
  deltaInverted,
  tone = 'cyan',
}: {
  label: string;
  value: string | number;
  icon: typeof ShieldAlert;
  delta?: number;
  deltaInverted?: boolean;
  tone?: 'cyan' | 'critical' | 'warning' | 'success';
}) {
  const toneMap = {
    cyan: 'text-cc-cyan',
    critical: 'text-cc-critical',
    warning: 'text-cc-warning',
    success: 'text-cc-success',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-cc-hairline/20 bg-cc-surface/95 px-4 py-3.5">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-cyan-300/[0.025] blur-2xl" />
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cc-dim">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${toneMap[tone]}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${toneMap[tone]}`}>{value}</div>
      {typeof delta === 'number' ? (
        <div className="mt-1 flex items-center gap-2">
          <Delta value={delta} inverted={deltaInverted} />
          <span className="text-[9px] text-cc-faint">vs previous period</span>
        </div>
      ) : null}
    </div>
  );
}

function RiskDistribution({
  stats,
  analytics,
}: {
  stats: DashboardStats;
  analytics?: AnalyticsData | null;
}) {
  const rows = useMemo(() => {
    const source = analytics?.severityDistribution;
    if (source && Object.keys(source).length) {
      return [
        { name: 'Critical', value: source.CRITICAL ?? 0, color: '#fb7185' },
        { name: 'High', value: source.HIGH ?? 0, color: '#fbbf24' },
        { name: 'Medium', value: source.MEDIUM ?? 0, color: '#fde047' },
        { name: 'Low', value: source.LOW ?? 0, color: '#34d399' },
      ];
    }

    return [
      { name: 'Critical', value: stats.criticalCount, color: '#fb7185' },
      { name: 'High', value: stats.highCount, color: '#fbbf24' },
      { name: 'Medium', value: stats.mediumCount, color: '#fde047' },
      { name: 'Low', value: 0, color: '#34d399' },
    ];
  }, [analytics, stats]);

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <CyberPanel className="h-full" accent="critical">
      <CyberPanelHeader
        eyebrow="Risk posture"
        title="Risk Distribution"
        description={total ? `${total.toLocaleString('en-IN')} findings in the current analytics window.` : 'Current severity distribution.'}
        action={<ShieldAlert className="h-4 w-4 text-cc-critical/80" />}
      />
      <div className="p-4 sm:p-5">
        <div className="grid gap-2">
          {rows.map((row) => {
            const width = total ? Math.max(3, (row.value / total) * 100) : 3;
            return (
              <div key={row.name} className="grid grid-cols-[70px_1fr_52px] items-center gap-3">
                <span className="text-[10px] text-cc-muted">{row.name}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-cc-elevated">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${width}%`, background: row.color, boxShadow: `0 0 12px ${row.color}55` }}
                  />
                </div>
                <span className="text-right font-mono text-[10px] text-cc-muted">{row.value.toLocaleString('en-IN')}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3">
            <div className="text-[9px] uppercase tracking-[0.15em] text-cc-faint">Overall score</div>
            <div className={`mt-1 text-xl font-semibold ${riskColor(stats.overallRiskScore)}`}>{stats.overallRiskScore}</div>
          </div>
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3">
            <div className="text-[9px] uppercase tracking-[0.15em] text-cc-faint">Assessments</div>
            <div className="mt-1 text-xl font-semibold text-cc-text">{stats.totalAssessments}</div>
          </div>
        </div>
      </div>
    </CyberPanel>
  );
}

/**
 * Chart colours read from the active theme.
 *
 * Recharts renders axis text and the tooltip as inline SVG attributes, so these
 * cannot be Tailwind classes and must be literal colours. They are kept here
 * rather than inline so the light/dark values stay in one place and the axis
 * labels stay legible in both themes.
 */
function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Default to dark until resolved, so server and first client render agree.
  const isDark = !mounted || resolvedTheme === 'dark';

  return {
    tick: isDark ? '#7f9aa0' : '#5a7078',
    grid: isDark ? 'rgba(120,210,220,0.10)' : 'rgba(13,139,153,0.14)',
    tooltipBg: isDark ? '#0b1c22' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(34,211,238,0.18)' : 'rgba(13,139,153,0.24)',
    tooltipText: isDark ? '#d8f8fa' : '#0f2530',
    cursor: isDark ? 'rgba(34,211,238,0.06)' : 'rgba(13,139,153,0.07)',
  };
}

function FindingsTrend({
  data,
}: {
  data: Array<{ name: string; total: number }>;
}) {
  const chart = useChartTheme();

  return (
    <CyberPanel className="min-h-[310px]">
      <CyberPanelHeader
        eyebrow="Security telemetry"
        title="Findings Over Time"
        description="New findings discovered across the existing dashboard reporting period."
        action={<BarChart3 className="h-4 w-4 text-cc-cyan/70" />}
      />
      <div className="h-[245px] px-2 pb-3 pt-4 sm:px-4">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: chart.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chart.tick, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: chart.cursor }}
                contentStyle={{
                  // Recharts writes these as inline SVG styles, so they cannot
                  // take a Tailwind class and must be a literal colour.
                  background: chart.tooltipBg,
                  border: `1px solid ${chart.tooltipBorder}`,
                  borderRadius: 8,
                  color: chart.tooltipText,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#21d4fd" fillOpacity={0.72} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-cc-dim">No findings trend data available.</div>
        )}
      </div>
    </CyberPanel>
  );
}

function FinancialRisk({
  data,
  loading,
}: {
  data?: CyberRiskResponse | null;
  loading?: boolean;
}) {
  const totals = data?.totals;

  return (
    <CyberPanel className="min-h-[310px]" accent="success">
      <CyberPanelHeader
        eyebrow="Quantified exposure"
        title="Financial Cyber Risk"
        description="Existing SentinelStack risk model outputs, presented in the new command-center visual language."
        action={<CircleDollarSign className="h-4 w-4 text-cc-cyan/70" />}
      />

      {loading ? (
        <div className="flex h-[245px] items-center justify-center text-xs text-cc-dim">
          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
          Calculating enterprise exposure…
        </div>
      ) : totals ? (
        <div className="grid h-[245px] gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.16em] text-cc-faint">Financial exposure</span>
              <CyberStatusDot tone="cyan" pulse />
            </div>
            <div className="mt-2 text-2xl font-semibold text-cc-cyan">{formatInr(totals.totalFinancialExposureInr)}</div>
            <div className="mt-1 text-[10px] text-cc-dim">{totals.assets} modeled enterprise assets</div>
          </div>
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-cc-faint">Expected annual loss</div>
            <div className="mt-1 text-lg font-semibold text-cc-critical">{formatInr(totals.expectedAnnualLossInr)}</div>
          </div>
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-cc-faint">Value at risk</div>
            <div className="mt-1 text-lg font-semibold text-cc-warning">{formatInr(totals.valueAtRisk95Inr)}</div>
          </div>
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-cc-faint">Control effectiveness</div>
            <div className="mt-1 text-lg font-semibold text-cc-success">{formatPercent(totals.controlEffectiveness)}</div>
          </div>
          <div className="rounded-lg border border-cc-hairline/20 bg-cc-elevated p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-cc-faint">Average likelihood</div>
            <div className="mt-1 text-lg font-semibold text-cc-cyan">{formatPercent(totals.averageLikelihood)}</div>
          </div>
        </div>
      ) : (
        <div className="flex h-[245px] items-center justify-center px-6 text-center text-xs leading-relaxed text-cc-dim">
          Financial risk data is not currently available. The existing backend calculation can be enabled without changing this presentation layer.
        </div>
      )}
    </CyberPanel>
  );
}

/** Colour cue for a driver type. Presentation only — carries no meaning beyond grouping. */
function driverTypeTone(type: string) {
  switch (type) {
    case 'VULNERABILITY':
      return 'border-rose-300/20 bg-cc-critical/10 text-cc-critical';
    case 'EXPOSURE':
      return 'border-amber-300/20 bg-cc-warning/10 text-cc-warning';
    case 'CONTROL':
      return 'border-cc-cyan/25 bg-cc-cyan/10 text-cc-cyan';
    case 'DEPENDENCY':
      return 'border-violet-300/20 bg-violet-300/[0.08] text-violet-200';
    case 'BUSINESS_IMPACT':
      return 'border-emerald-300/20 bg-cc-success/10 text-cc-success';
    default:
      return 'border-cc-hairline/25 bg-cc-elevated text-cc-muted';
  }
}

function confidenceTone(confidence: NormalizedRiskDriver['confidence']) {
  if (confidence === 'HIGH') return 'text-cc-success';
  if (confidence === 'MEDIUM') return 'text-amber-300';
  if (confidence === 'LOW') return 'text-cc-critical';
  return 'text-cc-dim';
}

function driverDirectionLabel(direction: NormalizedRiskDriver['direction']) {
  if (direction === 'REDUCES_RISK') return 'MITIGATES';
  if (direction === 'LIMITS_CONFIDENCE') return 'CONFIDENCE ONLY';
  return 'INCREASES RISK';
}

/**
 * P3 — evidence-linked risk drivers.
 *
 * Replaces the legacy "top risk drivers" asset list. The difference is not
 * cosmetic: a sorted asset list says *where* loss sits, whereas a driver says
 * *which factor* produced it, with a modelled contribution, a direction, a
 * confidence, and a count of the evidence records behind it.
 *
 * Wording is deliberately modelled. These are contributions to modelled risk,
 * not realised losses, and the panel says so (P3 spec §47).
 */
function RiskDrivers() {
  const { data: drivers, isLoading, isError } = useRiskDrivers(5);

  return (
    <CyberPanel accent="warning">
      <CyberPanelHeader
        eyebrow="Evidence-linked attribution"
        title="Top Financial Risk Drivers"
        description="Factors contributing most to modelled expected annual loss, with the evidence behind each."
        action={<Target className="h-4 w-4 text-cc-warning/70" />}
      />

      {isLoading ? (
        <div className="px-5 py-8 text-center text-xs text-cc-dim">Loading driver attribution…</div>
      ) : isError ? (
        <div className="px-5 py-8 text-center text-xs text-cc-dim">
          Driver attribution is unavailable. Run a risk calculation to generate it.
        </div>
      ) : !drivers?.length ? (
        <div className="px-5 py-8 text-center text-xs text-cc-dim">
          No modelled risk drivers are available yet. Run a risk calculation to produce them.
        </div>
      ) : (
        <div className="divide-y divide-cc-hairline/15">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="grid gap-3 px-4 py-3.5 sm:grid-cols-[28px_1fr_auto] sm:items-center sm:px-5"
            >
              <div className="font-mono text-[10px] text-cc-faint">
                {String(driver.rank).padStart(2, '0')}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-medium text-cc-text">{driver.name}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${driverTypeTone(driver.type)}`}
                  >
                    {driver.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-cc-dim">
                  <span>{driverDirectionLabel(driver.direction)}</span>
                  <span>
                    Confidence{' '}
                    <span className={confidenceTone(driver.confidence)}>{driver.confidence}</span>
                  </span>
                  <span>
                    {driver.evidenceCount} evidence record{driver.evidenceCount === 1 ? '' : 's'}
                  </span>
                  {driver.reviewStatus !== 'UNREVIEWED' ? (
                    <span className="text-cc-cyan/70">{driver.reviewStatus}</span>
                  ) : null}
                </div>
              </div>

              <div className="text-right sm:min-w-[170px]">
                <div className="text-[8px] uppercase tracking-wider text-cc-faint">
                  Modelled EAL contribution
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-cc-text">
                  {driver.contributionToEal === null
                    ? 'Not modelled'
                    : formatInr(driver.contributionToEal)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CyberPanel>
  );
}

function RecentAssessments({ assessments }: { assessments: DashboardAssessment[] }) {
  return (
    <CyberPanel>
      <CyberPanelHeader
        eyebrow="Assessment activity"
        title="Recent Assessments"
        description="Existing security assessments and their current risk state."
        action={
          <Link href="/dashboard/assessments" className="inline-flex items-center gap-1 text-[10px] text-cc-cyan/70 hover:text-cc-cyan">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px]">
          <thead>
            <tr className="border-b border-cc-hairline/15 text-left">
              <th className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-cc-faint sm:px-5">Assessment</th>
              <th className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-cc-faint">Status</th>
              <th className="px-4 py-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-cc-faint">Risk</th>
              <th className="px-4 py-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-cc-faint">Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {assessments.slice(0, 6).map((assessment) => (
              <tr key={assessment.id} className="border-b border-cc-hairline/10 transition-colors hover:bg-cc-cyan/[0.04]">
                <td className="max-w-[360px] px-4 py-3 sm:px-5">
                  <div className="truncate text-xs font-medium text-cc-text">{assessment.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-cc-faint">{assessment.targetUrl}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-1.5 py-1 text-[8px] font-semibold uppercase tracking-wider ${statusClass(assessment.status)}`}>
                    {assessment.status.replace('_', ' ')}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${riskColor(assessment.riskScore ?? 0)}`}>
                  {assessment.riskScore ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-[10px] text-cc-dim">
                  {assessment.createdAt ? new Date(assessment.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/assessments/${assessment.id}`}
                    className="text-[10px] text-cc-cyan/65 hover:text-cc-cyan"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!assessments.length ? (
          <div className="px-5 py-10 text-center text-xs text-cc-dim">
            No assessments have been recorded yet.
          </div>
        ) : null}
      </div>
    </CyberPanel>
  );
}

function AdminQueue({ data, loading }: { data?: ScanQueueStats | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-cc-hairline/15 bg-cc-elevated px-4 py-2.5 text-[10px] text-cc-dim">
        Loading scan queue health…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-2 rounded-lg border border-cc-hairline/15 bg-cc-elevated p-2 sm:grid-cols-5">
      {[
        ['Queued', data.counts.QUEUED ?? 0],
        ['Running', data.counts.RUNNING ?? 0],
        ['Failed', data.counts.FAILED ?? 0],
        ['Runnable', data.runnableQueued],
        ['Oldest', `${data.oldestQueuedAgeSeconds}s`],
      ].map(([label, value]) => (
        <div key={label} className="rounded-md border border-cc-hairline/10 px-3 py-2">
          <div className="text-[8px] uppercase tracking-wider text-cc-faint">{label}</div>
          <div className="mt-0.5 text-sm font-semibold text-cc-text">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function DashboardCommandCenter({
  userName,
  stats,
  recentAssessments,
  findingsOverTime,
  cyberRisk,
  analytics,
  scanQueueStats,
  isScanQueueLoading,
  isCyberRiskLoading,
  onRefresh,
}: DashboardCommandCenterProps) {
  const [globeVisible, setGlobeVisible] = useState(false);
  const healthText = cyberRisk ? 'Risk model synchronized' : 'Core telemetry online';

  return (
    <div className="min-h-screen bg-cc-bg text-cc-text">
      {/* Ambient wash is dialled back in light mode; the same opacity reads as a
          grey haze over a white surface. */}
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_48%_30%,rgba(13,139,153,0.07),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(18,190,207,0.035),transparent_26%)] dark:bg-[radial-gradient(circle_at_48%_30%,rgba(13,139,153,0.10),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(18,190,207,0.05),transparent_26%)]" />

      <main className="relative z-10 w-full px-3 pb-8 pt-3 sm:px-5 md:px-6 lg:px-7">
        <header className="mb-4 flex flex-col gap-3 border-b border-cc-hairline/20 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <CyberStatusDot tone="green" pulse />
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cc-success/90">Command center online</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-cc-text sm:text-3xl">
              Enterprise Cyber Risk
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-cc-muted sm:text-sm">
              Continuous cyber-risk intelligence, financial exposure and security posture analytics for {userName || 'your organization'}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-cc-hairline/20 bg-cc-elevated px-3 py-2 text-[9px] text-cc-dim sm:flex">
              <Activity className="h-3.5 w-3.5 text-cc-cyan" />
              {healthText}
            </div>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-cc-hairline/20 bg-cc-elevated px-3 text-[10px] font-medium text-cc-muted transition hover:border-cc-cyan/40 hover:bg-cc-cyan/10 hover:text-cc-cyan"
                title="Refresh dashboard data"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            ) : null}
            <Link
              href="/dashboard/reports"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-cc-cyan/25 bg-cc-cyan/10 px-3 text-[10px] font-semibold text-cc-cyan transition hover:bg-cc-cyan/20"
            >
              <FileDown className="h-3.5 w-3.5" />
              Executive report
            </Link>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Metric
            label="Overall Risk Score"
            value={stats.overallRiskScore}
            icon={Gauge}
            delta={stats.deltas.overallRiskScore}
            tone={stats.overallRiskScore >= 80 ? 'critical' : stats.overallRiskScore >= 60 ? 'warning' : 'cyan'}
          />
          <Metric
            label="Critical Findings"
            value={stats.criticalCount}
            icon={ShieldAlert}
            delta={stats.deltas.criticalCount}
            tone="critical"
          />
          <Metric
            label="High Findings"
            value={stats.highCount}
            icon={Network}
            delta={stats.deltas.highCount}
            tone="warning"
          />
          <Metric
            label="Total Assessments"
            value={stats.totalAssessments}
            icon={ShieldCheck}
            delta={stats.deltas.totalAssessments}
            deltaInverted
            tone="success"
          />
        </div>

        <AdminQueue data={scanQueueStats} loading={isScanQueueLoading} />

        {/* The button lives outside the section so it stays reachable once the
            section is collapsed. Toggling hides the whole block, including the
            risk distribution panel beside the globe. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-cc-cyan/50">
              Infrastructure surface
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-cc-text">Digital Earth</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-cc-muted">
              {globeVisible
                ? 'Rendered on demand. Rotation only; no zoom or pan.'
                : 'Collapsed to reduce GPU and battery cost on the command center.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGlobeVisible((visible) => !visible)}
            aria-pressed={globeVisible}
            aria-label={globeVisible ? 'Hide digital Earth section' : 'Show digital Earth section'}
            aria-expanded={globeVisible}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cc-cyan/25 bg-cc-elevated px-3 py-2 text-[11px] font-semibold text-cc-cyan/90 transition hover:border-cc-cyan/50 hover:bg-cc-cyan/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cc-cyan"
          >
            <Globe2 className="h-4 w-4" />
            {globeVisible ? 'Hide Globe' : 'Show Globe'}
          </button>
        </div>

        {globeVisible ? (
          <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <CyberPanel className="relative min-h-[340px] overflow-hidden bg-cc-viewport" accent="cyan">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_48%,rgba(23,199,218,0.13),transparent_37%)]" />
              <div className="absolute inset-0">
                <SentinelGlobe className="h-full w-full" />
              </div>
            </CyberPanel>

            <RiskDistribution stats={stats} analytics={analytics} />
          </section>
        ) : null}

        <section className="mt-3 grid gap-3 lg:grid-cols-2">
          <FindingsTrend data={findingsOverTime} />
          <FinancialRisk data={cyberRisk} loading={isCyberRiskLoading} />
        </section>

        <section className="mt-3">
          <RiskDrivers />
        </section>

        <section className="mt-3">
          <RecentAssessments assessments={recentAssessments} />
        </section>


      </main>
    </div>
  );
}
