'use client';

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

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  severityOverTime: SeverityOverTimeRow[];
  riskScoreOverTime: Array<{ name: string; avgRiskScore: number }>;
  severityDistribution: SeverityDistribution;
  topTools: Array<{ toolName: string; total: number; CRITICAL: number; HIGH: number; MEDIUM: number }>;
  topTargets: Array<{ targetUrl: string; avgRiskScore: number; assessments: number }>;
  recentHighRiskAssessments: RecentHighRiskAssessment[];
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

function formatPercent(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function Delta({ value, kind }: { value: number; kind: 'percent' | 'count' }) {
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
      <span className="text-muted-foreground">last 30d</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  delta,
  deltaKind,
}: {
  title: string;
  value: string | number;
  delta?: number;
  deltaKind?: 'percent' | 'count';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {typeof delta === 'number' && deltaKind ? <Delta value={delta} kind={deltaKind} /> : null}
      </CardContent>
    </Card>
  );
}

export default function RiskAnalyticsView({ data }: { data: AnalyticsResponse }) {
  const severityRows = Object.entries(data.severityDistribution ?? {})
    .map(([severity, count]) => ({ severity, count }));

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  severityRows.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  const topTargets = data.topTargets ?? [];
  const recent = data.recentHighRiskAssessments ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard
          title="Overall Risk Score"
          value={data.stats?.overallRiskScore ?? 0}
          delta={data.stats?.deltas?.overallRiskScore}
          deltaKind="percent"
        />
        <StatCard
          title="Total Assessments"
          value={data.stats?.totalAssessments ?? 0}
          delta={data.stats?.deltas?.totalAssessments}
          deltaKind="count"
        />
        <StatCard
          title="Critical Findings"
          value={data.stats?.criticalCount ?? 0}
          delta={data.stats?.deltas?.criticalCount}
          deltaKind="percent"
        />
        <StatCard
          title="High Findings"
          value={data.stats?.highCount ?? 0}
          delta={data.stats?.deltas?.highCount}
          deltaKind="percent"
        />
        <StatCard title="Total Findings" value={data.stats?.totalFindings ?? 0} />
      </div>

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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" interval={1} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="total" fill={chartColors.teal} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityRows} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="severity" width={90} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {severityRows.map((row, idx) => (
                    <Cell key={`${row.severity}-${idx}`} fill={severityColors[row.severity] ?? 'hsl(var(--muted-foreground))'} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="toolName" width={180} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="total" fill={chartColors.violet} radius={[0, 8, 8, 0]} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" interval={1} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="CRITICAL" stackId="a" fill={severityColors.CRITICAL} radius={[0, 0, 0, 0]} />
              <Bar dataKey="HIGH" stackId="a" fill={severityColors.HIGH} radius={[0, 0, 0, 0]} />
              <Bar dataKey="MEDIUM" stackId="a" fill={severityColors.MEDIUM} radius={[0, 0, 0, 0]} />
              <Bar dataKey="LOW" stackId="a" fill={severityColors.LOW} radius={[0, 0, 0, 0]} />
              <Bar dataKey="INFO" stackId="a" fill={severityColors.INFO} radius={[6, 6, 0, 0]} />
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
                    <div className="truncate font-medium">{t.targetUrl}</div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="min-w-[280px]">
                      <div className="font-medium truncate">{a.targetUrl}</div>
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
