'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import api from '@/lib/api';
import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TargetAnalyticsResponse = {
  targetUrl: string;
  staleThresholdDays: number;
  latestAttempt: null | { id: string; status: string; createdAt: string };
  latestCompleted: null | { id: string; createdAt: string; riskScore: number | null };
  daysSinceLastCompleted: number | null;
  isStale: boolean;
  riskTimeline: Array<{
    id: string;
    name: string;
    createdAt: string;
    riskScore: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
  }>;
  recurringFindings: Array<{
    toolName: string;
    title: string;
    severity: string;
    occurrencesLast180d: number;
    lastSeenAt: string;
    lastSeenAssessmentId: string;
    remediationPreview: string;
  }>;
};

const chartColors = {
  cyan: '#00E5FF',
  teal: '#1DE9B6',
  magenta: '#E91E63',
} as const;

function formatShortDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

export default function TargetDrilldownPage() {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');

  usePageTitle(target ? `Target: ${target}` : 'Target Drilldown');

  const { data, isLoading, error } = useQuery<TargetAnalyticsResponse, Error>({
    queryKey: ['targetAnalytics', target],
    queryFn: async () => {
      const res = await api.get('/dashboard/target', { params: { targetUrl: target } });
      return res.data;
    },
    enabled: Boolean(target && target.trim().length > 0),
    retry: false,
  });

  useEffect(() => {
    // noop placeholder: keeps pattern consistent with other pages
  }, []);

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-headline text-primary-foreground">Target Drilldown</h1>
          <p className="text-muted-foreground break-all">
            {target ? target : 'Pick a target from Risk Analytics → Top Targets'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/analytics">Back to Analytics</Link>
          </Button>
          {target ? (
            <>
              <Button asChild>
                <Link
                  href={`/dashboard/assessments/new?target=${encodeURIComponent(target)}&toolPreset=access-control&scope=API`}
                >
                  QuickScan (IDOR)
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/assessments/new?target=${encodeURIComponent(target)}`}>New assessment</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/dashboard/assessments?target=${encodeURIComponent(target)}`}>View assessments</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {!target ? (
        <Card>
          <CardHeader>
            <CardTitle>No target selected</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open Risk Analytics and click a target under “Top Targets”.
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load target analytics</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The server could not fetch drilldown data for this target.
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Staleness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.isStale ? 'text-destructive' : ''}`}>
                  {data.daysSinceLastCompleted === null ? 'N/A' : `${data.daysSinceLastCompleted}d`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Threshold: {data.staleThresholdDays} days
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Latest Completed Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{data.latestCompleted?.riskScore ?? 'N/A'}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {data.latestCompleted ? new Date(data.latestCompleted.createdAt).toLocaleString() : 'No completed runs yet'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Latest Attempt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.latestAttempt?.status ?? 'N/A'}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {data.latestAttempt ? new Date(data.latestAttempt.createdAt).toLocaleString() : 'No attempts yet'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Runs (shown)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{data.riskTimeline.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Most recent completed runs</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Risk Score Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.riskTimeline.map(r => ({ ...r, label: formatShortDate(r.createdAt) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="label" interval={0} tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Line type="monotone" dataKey="riskScore" stroke={chartColors.cyan} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Findings Volume</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.riskTimeline.map(r => ({ ...r, label: formatShortDate(r.createdAt) }))}>
                    <defs>
                      <linearGradient id="target-findingsVolume-total" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColors.teal} stopOpacity={0.9} />
                        <stop offset="55%" stopColor={chartColors.teal} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={chartColors.teal} stopOpacity={0.48} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="label" interval={0} tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="totalFindings" fill="url(#target-findingsVolume-total)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recurring Findings (last 180 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recurringFindings.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recurring findings yet for this target.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead className="text-right">Occurrences</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead className="text-right"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recurringFindings.map((f, idx) => (
                      <TableRow key={`${f.toolName}-${idx}`}>
                        <TableCell className="min-w-[340px]">
                          <div className="font-medium">{f.title}</div>
                          <div className="text-xs text-muted-foreground">{f.toolName}</div>
                          {f.remediationPreview ? (
                            <div className="mt-1 text-xs text-muted-foreground">Fix: {f.remediationPreview}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">{f.severity}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.occurrencesLast180d}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(f.lastSeenAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/dashboard/assessments/${f.lastSeenAssessmentId}?tab=findings&finding=${encodeURIComponent(
                                `${String(f.toolName).toLowerCase()}::${String(f.title).toLowerCase()}`
                              )}`}
                            >
                              Jump
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
