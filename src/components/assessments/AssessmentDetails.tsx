'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Assessment, Finding, Severity } from '@prisma/client';
import { FileText, Loader2, Shield, ShieldAlert, ShieldCheck, ShieldHalf, Star } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { AISummaryButton } from './AISummaryButton';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { getSeverityCounts } from '@/services/riskScoring.service';

type AssessmentWithDetails = Assessment & { findings: Finding[] };

type AssessmentDetailsProps = {
  assessment: AssessmentWithDetails;
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

export function AssessmentDetails({ assessment }: AssessmentDetailsProps) {
  const { findings, riskScore } = assessment;
  const summary = getSeverityCounts(findings);
  const isRunning = assessment.status === 'IN_PROGRESS' || assessment.status === 'PENDING';
  const canGenerateReport = assessment.status === 'COMPLETED';
  
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
          </div>
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
      <Tabs defaultValue="summary" className="mt-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
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
              <Accordion type="single" collapsible className="w-full">
                {findings.map((finding) => (
                  <FindingItem key={finding.id} finding={finding} />
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function FindingItem({ finding }: { finding: Finding }) {
  return (
    <AccordionItem value={finding.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-4 text-left">
          {severityIcons[finding.severity]}
          <div className="flex-1">
            <p className="font-semibold">{finding.title}</p>
            <p className="text-sm text-muted-foreground">Found by: {finding.toolName}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pl-12">
        <p className="text-sm">{finding.description}</p>
        <div>
            <h4 className="font-semibold text-sm mb-1">Remediation</h4>
            <p className="text-sm text-muted-foreground">{finding.remediation}</p>
        </div>
        <div>
            <h4 className="font-semibold text-sm mb-1">Compliance</h4>
            <div className="flex gap-2">
                {finding.complianceMapping.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
            </div>
        </div>
        <Accordion type="single" collapsible>
            <AccordionItem value="evidence">
                <AccordionTrigger className="text-sm">View Evidence</AccordionTrigger>
                <AccordionContent>
                    <pre className="bg-secondary p-4 rounded-md text-xs overflow-x-auto font-code">
                        {JSON.stringify(finding.evidence, null, 2)}
                    </pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  );
}
