'use client';

import { Activity, ArrowDownRight, ArrowUpRight, ShieldAlert, ShieldHalf, ShieldQuestion } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import Link from 'next/link';
import type { Assessment, AssessmentStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

type OverviewProps = {
  stats: {
    overallRiskScore: number; totalAssessments: number; criticalCount: number; highCount: number; mediumCount: number;
    deltas: { overallRiskScore: number; criticalCount: number; highCount: number; totalAssessments: number }
  };
  recentAssessments: Assessment[];
  findingsOverTime: { name: string; total: number }[];
};

const chartConfig = { total: { label: 'Findings', color: 'hsl(var(--chart-1))' } } satisfies ChartConfig;

const getStatusBadgeVariant = (status: AssessmentStatus) => {
  switch (status) { case 'COMPLETED': return 'default'; case 'IN_PROGRESS': return 'secondary'; case 'PENDING': return 'outline'; case 'REJECTED': return 'destructive'; default: return 'secondary'; }
};

const getRiskScoreColor = (score: number) => score > 80 ? 'text-rose-300' : score > 60 ? 'text-orange-300' : score > 40 ? 'text-yellow-200' : 'text-emerald-300';

const DeltaIndicator = ({ value, unit, higherIsWorse }: { value: number; unit: '%' | 'raw'; higherIsWorse: boolean }) => {
  const positive = value > 0; const negative = value < 0;
  const colorClass = (positive && higherIsWorse) || (negative && !higherIsWorse) ? 'text-rose-300' : 'text-emerald-300';
  if (value === 0) return <p className="text-[10px] text-slate-600">No change from last month</p>;
  return <p className={cn('flex items-center text-[10px]', colorClass)}>{positive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}{Math.abs(value).toFixed(1)}{unit === '%' ? '%' : ''} {positive ? 'increase' : 'decrease'} from last month</p>;
};

export function Overview({ stats, recentAssessments, findingsOverTime }: OverviewProps) {
  const metricCards = [
    { label: 'Overall Risk Score', value: stats.overallRiskScore, icon: ShieldQuestion, color: getRiskScoreColor(stats.overallRiskScore), delta: stats.deltas.overallRiskScore },
    { label: 'Critical Findings', value: stats.criticalCount, icon: ShieldAlert, color: 'text-rose-300', delta: stats.deltas.criticalCount },
    { label: 'High Findings', value: stats.highCount, icon: ShieldHalf, color: 'text-orange-300', delta: stats.deltas.highCount },
    { label: 'Total Assessments', value: stats.totalAssessments, icon: Activity, color: 'text-cyan-200', delta: stats.deltas.totalAssessments },
  ];

  return <>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metricCards.map(metric => <Card key={metric.label} className="soc-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-slate-600">{metric.label}</CardTitle>
          <metric.icon className={cn('h-4 w-4', metric.color)} />
        </CardHeader>
        <CardContent>
          <div className={cn('font-mono text-3xl font-semibold tracking-tight', metric.color)}>{metric.value}</div>
          <div className="mt-2"><DeltaIndicator value={metric.delta} unit="%" higherIsWorse={metric.label !== 'Total Assessments'} /></div>
        </CardContent>
      </Card>)}
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card className="soc-card overflow-hidden xl:col-span-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-3"><div><div className="soc-kicker">Telemetry / 01</div><CardTitle className="mt-1 text-base">Recent Assessments</CardTitle><CardDescription className="text-xs text-slate-600">An overview of your latest security scans.</CardDescription></div><ShieldAlert className="h-5 w-5 text-cyan-300/70" /></div>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[500px]">
            <TableHeader><TableRow className="border-cyan-300/10 hover:bg-transparent"><TableHead className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Assessment</TableHead><TableHead className="hidden sm:table-cell font-mono text-[9px] uppercase tracking-wider text-slate-600">Status</TableHead><TableHead className="text-right font-mono text-[9px] uppercase tracking-wider text-slate-600">Risk Score</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {recentAssessments.map(assessment => <TableRow key={assessment.id} className="border-cyan-300/[.05] hover:bg-cyan-300/[.025]">
                <TableCell><div className="font-medium text-slate-200">{assessment.name}</div><div className="hidden text-[10px] text-slate-600 md:inline">{assessment.targetUrl}</div></TableCell>
                <TableCell className="hidden sm:table-cell"><Badge className={cn('border-cyan-300/10 text-[8px] tracking-wider', assessment.status === 'IN_PROGRESS' && 'animate-pulse')} variant={getStatusBadgeVariant(assessment.status)}>{assessment.status}</Badge></TableCell>
                <TableCell className={cn('text-right font-mono font-semibold', getRiskScoreColor(assessment.riskScore ?? 0))}>{assessment.riskScore ?? 'N/A'}</TableCell>
                <TableCell className="text-right"><Button asChild variant="outline" size="sm" className="h-7 border-cyan-300/10 bg-transparent text-[10px] hover:bg-cyan-300/[.05]"><Link href={`/dashboard/assessments/${assessment.id}`}>View</Link></Button></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="soc-card overflow-hidden">
        <CardHeader><div className="soc-kicker">Telemetry / 02</div><CardTitle className="mt-1 text-base">Findings Over Time</CardTitle><CardDescription className="text-xs text-slate-600">New findings discovered per month.</CardDescription></CardHeader>
        <CardContent><ChartContainer config={chartConfig} className="min-h-[220px] w-full min-w-[280px]"><BarChart accessibilityLayer data={findingsOverTime}><CartesianGrid vertical={false} stroke="rgba(33,212,253,.08)" /><XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tick={{ fill: '#789296', fontSize: 9 }} /><YAxis tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: '#789296', fontSize: 9 }} /><ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} /><Bar dataKey="total" fill="var(--color-total)" radius={3} /></BarChart></ChartContainer></CardContent>
      </Card>
    </div>
  </>;
}
