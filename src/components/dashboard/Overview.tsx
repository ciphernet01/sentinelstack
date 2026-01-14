
'use client';

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  ShieldHalf,
  ShieldQuestion,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import Link from 'next/link';
import type { Assessment, AssessmentStatus } from '@prisma/client';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

type OverviewProps = {
  stats: {
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
    }
  };
  recentAssessments: Assessment[];
  findingsOverTime: { name: string; total: number }[];
};

const chartConfig = {
  total: {
    label: 'Findings',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const getStatusBadgeVariant = (status: AssessmentStatus) => {
    switch (status) {
        case 'COMPLETED': return 'default';
        case 'IN_PROGRESS': return 'secondary';
        case 'PENDING': return 'outline';
        case 'REJECTED': return 'destructive';
        default: return 'secondary';
    }
}


const getRiskScoreColor = (score: number) => {
    if (score > 80) return "text-red-500";
    if (score > 60) return "text-orange-500";
    if (score > 40) return "text-yellow-500";
    return "text-green-500";
};

const DeltaIndicator = ({ value, unit, higherIsWorse }: { value: number; unit: '%' | 'raw'; higherIsWorse: boolean }) => {
    const isPositive = value > 0;
    const isNegative = value < 0;

    // Red for bad, green for good
    const colorClass = (isPositive && higherIsWorse) || (isNegative && !higherIsWorse) ? 'text-red-500' : 'text-green-500';

    if (value === 0) {
        return <p className="text-xs text-muted-foreground">No change from last month</p>
    }

    return (
        <p className={cn("text-xs text-muted-foreground flex items-center", colorClass)}>
            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(value).toFixed(1)}{unit === '%' ? '%' : ''} {isPositive ? 'increase' : 'decrease'} from last month
        </p>
    )
}

export function Overview({ stats, recentAssessments, findingsOverTime }: OverviewProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Risk Score</CardTitle>
            <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRiskScoreColor(stats.overallRiskScore)}`}>{stats.overallRiskScore}</div>
            <DeltaIndicator value={stats.deltas.overallRiskScore} unit="%" higherIsWorse={true} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Findings</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.criticalCount}</div>
            <DeltaIndicator value={stats.deltas.criticalCount} unit="%" higherIsWorse={true} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Findings</CardTitle>
            <ShieldHalf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.highCount}</div>
            <DeltaIndicator value={stats.deltas.highCount} unit="%" higherIsWorse={true} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssessments}</div>
            <p className="text-xs text-muted-foreground">
                {stats.deltas.totalAssessments > 0 ? `+${stats.deltas.totalAssessments}` : stats.deltas.totalAssessments} since last month
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent Assessments</CardTitle>
            <CardDescription>An overview of your latest security scans.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAssessments.map(assessment => (
                    <TableRow key={assessment.id}>
                        <TableCell>
                            <div className="font-medium">{assessment.name}</div>
                            <div className="hidden text-sm text-muted-foreground md:inline">
                                {assessment.targetUrl}
                            </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                            <Badge 
                                className={cn("text-xs", assessment.status === 'IN_PROGRESS' && 'animate-pulse')}
                                variant={getStatusBadgeVariant(assessment.status)}
                            >
                                {assessment.status}
                            </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${getRiskScoreColor(assessment.riskScore ?? 0)}`}>
                            {assessment.riskScore ?? 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/assessments/${assessment.id}`}>View</Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Findings Over Time</CardTitle>
            <CardDescription>Number of new findings discovered per month.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
              <BarChart accessibilityLayer data={findingsOverTime}>
                 <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                 <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                 />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

