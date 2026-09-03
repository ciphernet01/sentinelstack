'use client';

import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Calculator,
  Gauge,
  IndianRupee,
  LineChart,
  LockKeyhole,
  PieChart,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import type { CyberRiskResponse } from '@/hooks/use-cyber-risk';
import { cn } from '@/lib/utils';

type ExecutiveRiskOverviewProps = {
  data: CyberRiskResponse;
  isLoading?: boolean;
};

const chartConfig = {
  eal: {
    label: 'Expected Annual Loss',
    color: 'hsl(var(--chart-1))',
  },
  reduction: {
    label: 'Risk Reduction',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

function formatInr(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
}: {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'neutral' | 'risk' | 'good' | 'money';
}) {
  const toneClass = {
    neutral: 'text-muted-foreground',
    risk: 'text-rose-500',
    good: 'text-emerald-500',
    money: 'text-cyan-500',
  }[tone];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', toneClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function criticalityClass(criticality: string) {
  switch (criticality) {
    case 'CRITICAL':
      return 'border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-200';
    case 'HIGH':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200';
    case 'MODERATE':
      return 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-200';
    default:
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  }
}

export function ExecutiveRiskOverview({ data }: ExecutiveRiskOverviewProps) {
  const totals = data.totals;
  const topDrivers = data.topRiskDrivers.slice(0, 5);
  const chartRows = topDrivers.map((driver) => ({
    name: driver.serviceName.length > 18 ? `${driver.serviceName.slice(0, 16)}...` : driver.serviceName,
    eal: driver.expectedAnnualLossInr,
    fill: driver.internetExposed ? 'hsl(var(--destructive))' : 'hsl(var(--chart-1))',
  }));

  const selectedAllocation = data.optimization.selected.slice(0, 5);
  const budgetUsedPercent =
    data.optimization.budgetInr > 0
      ? Math.min(100, Math.round((data.optimization.spendInr / data.optimization.budgetInr) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Calculator className="h-3.5 w-3.5" />
                Deterministic risk model
              </Badge>
              <Badge variant="secondary">Continuous Cyber Risk Intelligence</Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold md:text-2xl">Enterprise Cyber Risk</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Financial exposure, expected annual loss, and investment allocation calculated from assets,
              vulnerabilities, telemetry, business impact, and control effectiveness.
            </p>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            Computed {new Date(data.computedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Financial Cyber Exposure"
          value={formatInr(totals.totalFinancialExposureInr)}
          description={`${totals.assets} modeled enterprise assets`}
          icon={IndianRupee}
          tone="money"
        />
        <MetricCard
          title="Expected Annual Loss"
          value={formatInr(totals.expectedAnnualLossInr)}
          description="Likelihood-adjusted annualized loss"
          icon={AlertTriangle}
          tone="risk"
        />
        <MetricCard
          title="Value at Risk"
          value={formatInr(totals.valueAtRisk95Inr)}
          description="95th percentile modeled loss proxy"
          icon={Gauge}
          tone="risk"
        />
        <MetricCard
          title="Control Effectiveness"
          value={formatPercent(totals.controlEffectiveness)}
          description={`Average likelihood ${formatPercent(totals.averageLikelihood)}`}
          icon={ShieldCheck}
          tone="good"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Top Financial Risk Drivers</CardTitle>
                <CardDescription>Assets contributing most to expected annual loss.</CardDescription>
              </div>
              <LineChart className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-3">
                {topDrivers.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                    Seed the enterprise digital twin or ingest asset telemetry to unlock financial risk drivers.
                  </div>
                ) : (
                  topDrivers.map((driver, index) => (
                    <div key={driver.assetId} className="rounded-md border p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                            <Badge variant="outline" className={criticalityClass(driver.criticality)}>
                              {driver.criticality}
                            </Badge>
                            {driver.internetExposed ? <Badge variant="destructive">Internet exposed</Badge> : null}
                          </div>
                          <div className="mt-2 font-semibold">{driver.serviceName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {driver.businessUnit} · {driver.hostname}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-semibold tabular-nums">{formatInr(driver.expectedAnnualLossInr)}</div>
                          <div className="text-xs text-muted-foreground">EAL</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-md bg-muted/35 p-2">
                          <div className="text-muted-foreground">Likelihood</div>
                          <div className="font-semibold tabular-nums">{formatPercent(driver.annualLikelihood)}</div>
                        </div>
                        <div className="rounded-md bg-muted/35 p-2">
                          <div className="text-muted-foreground">Impact</div>
                          <div className="font-semibold tabular-nums">{formatInr(driver.impactInr)}</div>
                        </div>
                        <div className="rounded-md bg-muted/35 p-2">
                          <div className="text-muted-foreground">Open / exploitable</div>
                          <div className="font-semibold tabular-nums">
                            {driver.openVulnerabilities} / {driver.exploitableVulnerabilities}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="min-h-[320px]">
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <BarChart accessibilityLayer data={chartRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          formatter={(value) => formatInr(Number(value))}
                        />
                      }
                    />
                    <Bar dataKey="eal" radius={4}>
                      {chartRows.map((row) => (
                        <Cell key={row.name} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Investment Optimization</CardTitle>
                <CardDescription>Best risk reduction under the active budget.</CardDescription>
              </div>
              <PieChart className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Budget used</span>
                <span className="font-medium tabular-nums">
                  {formatInr(data.optimization.spendInr)} / {formatInr(data.optimization.budgetInr)}
                </span>
              </div>
              <Progress value={budgetUsedPercent} className="mt-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Risk reduction</div>
                <div className="mt-1 font-semibold tabular-nums">
                  {formatInr(data.optimization.estimatedRiskReductionInr)}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">ROSI</div>
                <div className="mt-1 font-semibold tabular-nums">{data.optimization.rosi.toFixed(2)}x</div>
              </div>
            </div>
            <div className="space-y-2">
              {selectedAllocation.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No recommendations fit the current budget.
                </div>
              ) : (
                selectedAllocation.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.category} · {item.serviceName}</div>
                      </div>
                      <Badge variant="outline">{formatInr(item.costInr)}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {formatInr(item.estimatedEalReductionInr)} modeled EAL reduction
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {data.scenarios.map((scenario) => (
          <Card key={scenario.type}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{scenario.name}</CardTitle>
                {scenario.type.includes('MFA') ? (
                  <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                ) : scenario.type.includes('PATCH') ? (
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted/35 p-2">
                  <div className="text-xs text-muted-foreground">New EAL</div>
                  <div className="font-semibold tabular-nums">{formatInr(scenario.simulatedEalInr)}</div>
                </div>
                <div className="rounded-md bg-muted/35 p-2">
                  <div className="text-xs text-muted-foreground">Reduction</div>
                  <div className="font-semibold tabular-nums">{formatInr(scenario.riskReductionInr)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Implementation</span>
                <span className="font-medium text-foreground">{formatInr(scenario.implementationCostInr)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Modeled ROSI</span>
                <span className="font-medium text-foreground">{scenario.rosi.toFixed(2)}x</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-md border bg-card p-4 text-xs text-muted-foreground">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium text-foreground">{data.assumptions.model}</div>
              <div className="mt-1">{data.assumptions.formula}. {data.assumptions.note}</div>
            </div>
          </div>
          <Button variant="outline" size="sm">
            View Model Inputs
          </Button>
        </div>
      </div>
    </div>
  );
}
