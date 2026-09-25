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
import { useMemo } from 'react';

import type { CyberRiskResponse } from '@/hooks/use-cyber-risk';
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
  if (score >= 80) return 'text-rose-300';
  if (score >= 60) return 'text-amber-300';
  if (score >= 40) return 'text-yellow-200';
  return 'text-emerald-300';
}

function severityTone(severity: string) {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'text-rose-300 bg-rose-400/10 border-rose-300/15';
    case 'HIGH':
      return 'text-amber-200 bg-amber-300/10 border-amber-300/15';
    case 'MEDIUM':
      return 'text-yellow-200 bg-yellow-300/10 border-yellow-300/15';
    default:
      return 'text-cyan-200 bg-cyan-300/10 border-cyan-300/15';
  }
}

function statusClass(status: AssessmentStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'text-emerald-300 border-emerald-300/15 bg-emerald-300/10';
    case 'IN_PROGRESS':
      return 'text-cyan-200 border-cyan-300/15 bg-cyan-300/10';
    case 'REJECTED':
      return 'text-rose-300 border-rose-300/15 bg-rose-300/10';
    default:
      return 'text-slate-300 border-white/10 bg-white/[0.03]';
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
    return <span className="text-[10px] text-slate-500">No change</span>;
  }

  const positive = value > 0;
  const good = inverted ? !positive : positive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
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
    cyan: 'text-cyan-200',
    critical: 'text-rose-300',
    warning: 'text-amber-200',
    success: 'text-emerald-300',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-200/[0.08] bg-[#071317]/90 px-4 py-3.5">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-cyan-300/[0.025] blur-2xl" />
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${toneMap[tone]}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${toneMap[tone]}`}>{value}</div>
      {typeof delta === 'number' ? (
        <div className="mt-1 flex items-center gap-2">
          <Delta value={delta} inverted={deltaInverted} />
          <span className="text-[9px] text-slate-600">vs previous period</span>
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
        action={<ShieldAlert className="h-4 w-4 text-rose-300/80" />}
      />
      <div className="p-4 sm:p-5">
        <div className="grid gap-2">
          {rows.map((row) => {
            const width = total ? Math.max(3, (row.value / total) * 100) : 3;
            return (
              <div key={row.name} className="grid grid-cols-[70px_1fr_52px] items-center gap-3">
                <span className="text-[10px] text-slate-400">{row.name}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${width}%`, background: row.color, boxShadow: `0 0 12px ${row.color}55` }}
                  />
                </div>
                <span className="text-right font-mono text-[10px] text-slate-300">{row.value.toLocaleString('en-IN')}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.055] bg-black/10 p-3">
            <div className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Overall score</div>
            <div className={`mt-1 text-xl font-semibold ${riskColor(stats.overallRiskScore)}`}>{stats.overallRiskScore}</div>
          </div>
          <div className="rounded-lg border border-white/[0.055] bg-black/10 p-3">
            <div className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Assessments</div>
            <div className="mt-1 text-xl font-semibold text-slate-100">{stats.totalAssessments}</div>
          </div>
        </div>
      </div>
    </CyberPanel>
  );
}

function FindingsTrend({
  data,
}: {
  data: Array<{ name: string; total: number }>;
}) {
  return (
    <CyberPanel className="min-h-[310px]">
      <CyberPanelHeader
        eyebrow="Security telemetry"
        title="Findings Over Time"
        description="New findings discovered across the existing dashboard reporting period."
        action={<BarChart3 className="h-4 w-4 text-cyan-200/70" />}
      />
      <div className="h-[245px] px-2 pb-3 pt-4 sm:px-4">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="rgba(120,210,220,0.07)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64747a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64747a', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(34,211,238,0.04)' }}
                contentStyle={{
                  background: '#071317',
                  border: '1px solid rgba(34,211,238,0.12)',
                  borderRadius: 8,
                  color: '#d8f8fa',
                  fontSize: 11,
                }}
              />
              <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#21d4fd" fillOpacity={0.72} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">No findings trend data available.</div>
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
        action={<CircleDollarSign className="h-4 w-4 text-cyan-200/70" />}
      />

      {loading ? (
        <div className="flex h-[245px] items-center justify-center text-xs text-slate-500">
          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
          Calculating enterprise exposure…
        </div>
      ) : totals ? (
        <div className="grid h-[245px] gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-lg border border-cyan-200/[0.07] bg-black/10 p-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Financial exposure</span>
              <CyberStatusDot tone="cyan" pulse />
            </div>
            <div className="mt-2 text-2xl font-semibold text-cyan-100">{formatInr(totals.totalFinancialExposureInr)}</div>
            <div className="mt-1 text-[10px] text-slate-500">{totals.assets} modeled enterprise assets</div>
          </div>
          <div className="rounded-lg border border-white/[0.055] bg-black/10 p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Expected annual loss</div>
            <div className="mt-1 text-lg font-semibold text-rose-200">{formatInr(totals.expectedAnnualLossInr)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.055] bg-black/10 p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Value at risk</div>
            <div className="mt-1 text-lg font-semibold text-amber-100">{formatInr(totals.valueAtRisk95Inr)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.055] bg-black/10 p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Control effectiveness</div>
            <div className="mt-1 text-lg font-semibold text-emerald-200">{formatPercent(totals.controlEffectiveness)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.055] bg-black/10 p-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Average likelihood</div>
            <div className="mt-1 text-lg font-semibold text-cyan-100">{formatPercent(totals.averageLikelihood)}</div>
          </div>
        </div>
      ) : (
        <div className="flex h-[245px] items-center justify-center px-6 text-center text-xs leading-relaxed text-slate-500">
          Financial risk data is not currently available. The existing backend calculation can be enabled without changing this presentation layer.
        </div>
      )}
    </CyberPanel>
  );
}

function RiskDrivers({ data }: { data?: CyberRiskResponse | null }) {
  const drivers = data?.topRiskDrivers?.slice(0, 5) ?? [];

  return (
    <CyberPanel accent="warning">
      <CyberPanelHeader
        eyebrow="Risk attribution"
        title="Top Financial Risk Drivers"
        description="Assets contributing most to expected annual loss."
        action={<Target className="h-4 w-4 text-amber-200/70" />}
      />
      <div className="divide-y divide-white/[0.045]">
        {drivers.length ? (
          drivers.map((driver, index) => (
            <div key={driver.assetId} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[28px_1fr_auto] sm:items-center sm:px-5">
              <div className="font-mono text-[10px] text-slate-600">0{index + 1}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-medium text-slate-200">{driver.serviceName}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${severityTone(driver.criticality)}`}>
                    {driver.criticality}
                  </span>
                  {driver.internetExposed ? (
                    <span className="rounded border border-rose-300/10 bg-rose-300/[0.07] px-1.5 py-0.5 text-[8px] text-rose-200">
                      INTERNET EXPOSED
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 truncate text-[10px] text-slate-500">
                  {driver.businessUnit} · {driver.hostname}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-right sm:min-w-[270px]">
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-slate-600">EAL</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-200">{formatInr(driver.expectedAnnualLossInr)}</div>
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-slate-600">Likelihood</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-200">{formatPercent(driver.annualLikelihood)}</div>
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-slate-600">Open / Exploit</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-200">{driver.openVulnerabilities} / {driver.exploitableVulnerabilities}</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            No modeled risk drivers are available yet.
          </div>
        )}
      </div>
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
          <Link href="/dashboard/assessments" className="inline-flex items-center gap-1 text-[10px] text-cyan-200/70 hover:text-cyan-100">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px]">
          <thead>
            <tr className="border-b border-white/[0.045] text-left">
              <th className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 sm:px-5">Assessment</th>
              <th className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">Status</th>
              <th className="px-4 py-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">Risk</th>
              <th className="px-4 py-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {assessments.slice(0, 6).map((assessment) => (
              <tr key={assessment.id} className="border-b border-white/[0.035] transition-colors hover:bg-cyan-200/[0.025]">
                <td className="max-w-[360px] px-4 py-3 sm:px-5">
                  <div className="truncate text-xs font-medium text-slate-200">{assessment.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-600">{assessment.targetUrl}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-1.5 py-1 text-[8px] font-semibold uppercase tracking-wider ${statusClass(assessment.status)}`}>
                    {assessment.status.replace('_', ' ')}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${riskColor(assessment.riskScore ?? 0)}`}>
                  {assessment.riskScore ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-[10px] text-slate-500">
                  {assessment.createdAt ? new Date(assessment.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/assessments/${assessment.id}`}
                    className="text-[10px] text-cyan-200/65 hover:text-cyan-100"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!assessments.length ? (
          <div className="px-5 py-10 text-center text-xs text-slate-500">
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
      <div className="rounded-lg border border-cyan-300/[0.07] bg-black/10 px-4 py-2.5 text-[10px] text-slate-500">
        Loading scan queue health…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-2 rounded-lg border border-cyan-300/[0.07] bg-black/10 p-2 sm:grid-cols-5">
      {[
        ['Queued', data.counts.QUEUED ?? 0],
        ['Running', data.counts.RUNNING ?? 0],
        ['Failed', data.counts.FAILED ?? 0],
        ['Runnable', data.runnableQueued],
        ['Oldest', `${data.oldestQueuedAgeSeconds}s`],
      ].map(([label, value]) => (
        <div key={label} className="rounded-md border border-white/[0.035] px-3 py-2">
          <div className="text-[8px] uppercase tracking-wider text-slate-600">{label}</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-200">{value}</div>
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
  const healthText = cyberRisk ? 'Risk model synchronized' : 'Core telemetry online';

  return (
    <div className="min-h-screen bg-[#02080b] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_48%_30%,rgba(13,139,153,0.08),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(18,190,207,0.04),transparent_26%)]" />

      <main className="relative z-10 w-full px-3 pb-8 pt-3 sm:px-5 md:px-6 lg:px-7">
        <header className="mb-4 flex flex-col gap-3 border-b border-white/[0.055] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <CyberStatusDot tone="green" pulse />
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300/65">Command center online</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-3xl">
              Enterprise Cyber Risk
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
              Continuous cyber-risk intelligence, financial exposure and security posture analytics for {userName || 'your organization'}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[9px] text-slate-500 sm:flex">
              <Activity className="h-3.5 w-3.5 text-cyan-300/70" />
              {healthText}
            </div>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-[10px] font-medium text-slate-400 transition hover:border-cyan-200/15 hover:bg-cyan-300/[0.04] hover:text-cyan-100"
                title="Refresh dashboard data"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            ) : null}
            <Link
              href="/dashboard/reports"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-200/10 bg-cyan-300/[0.06] px-3 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
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

        <section className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <CyberPanel className="relative min-h-[510px] overflow-hidden bg-[#02090d]" accent="cyan">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_48%,rgba(23,199,218,0.13),transparent_37%)]" />
            <div className="absolute inset-0">
              <SentinelGlobe className="h-full w-full" />
            </div>
          </CyberPanel>

          <RiskDistribution stats={stats} analytics={analytics} />
        </section>

        <section className="mt-3 grid gap-3 lg:grid-cols-2">
          <FindingsTrend data={findingsOverTime} />
          <FinancialRisk data={cyberRisk} loading={isCyberRiskLoading} />
        </section>

        <section className="mt-3">
          <RiskDrivers data={cyberRisk} />
        </section>

        <section className="mt-3">
          <RecentAssessments assessments={recentAssessments} />
        </section>


      </main>
    </div>
  );
}
