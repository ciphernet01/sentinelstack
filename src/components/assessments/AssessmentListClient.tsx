'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Assessment, AssessmentStatus } from '@prisma/client';
import { ListFilter, File } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '@/lib/utils';

type AssessmentListClientProps = {
  assessments: Assessment[];
  targetFilter?: string | null;
};

const getRiskScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score > 80) return "text-red-500";
    if (score > 60) return "text-orange-500";
    if (score > 40) return "text-yellow-600";
    return "text-green-500";
};

const getStatusBadgeVariant = (status: AssessmentStatus) => {
    switch (status) {
        case 'COMPLETED': return 'default';
        case 'IN_PROGRESS': return 'secondary';
        case 'PENDING': return 'outline';
        case 'REJECTED': return 'destructive';
        default: return 'secondary';
    }
}

export function AssessmentListClient({ assessments: initialAssessments, targetFilter }: AssessmentListClientProps) {
    const assessments = initialAssessments;
    const [tab, setTab] = useState<AssessmentStatus | 'ALL'>('ALL');

    const filteredAssessments = useMemo(() => {
      return assessments.filter((assessment) => {
        if (tab === 'ALL') return true;
        return assessment.status === tab;
      });
    }, [assessments, tab]);

    const targetFilteredAssessments = useMemo(() => {
      const raw = String(targetFilter ?? '').trim();
      if (!raw) return filteredAssessments;

      const needle = raw.toLowerCase();
      return filteredAssessments.filter((assessment) =>
        String(assessment.targetUrl ?? '').toLowerCase().includes(needle)
      );
    }, [filteredAssessments, targetFilter]);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as any)}>
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
        </TabsList>
        <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 w-full sm:w-auto">
                <ListFilter className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Filter
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Risk Score</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="h-8 gap-1 w-full sm:w-auto">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>
        </div>
      </div>

      {String(targetFilter ?? '').trim() ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">Filtered target</Badge>
          <span className="text-muted-foreground break-all">{String(targetFilter).trim()}</span>
          <Button asChild variant="ghost" size="sm" className="h-7">
            <Link href="/dashboard/assessments">Clear</Link>
          </Button>
        </div>
      ) : null}

      <TabsContent value={tab}>
        <Card>
          <CardHeader>
            <CardTitle>Assessments</CardTitle>
            <CardDescription>
              Manage your security assessments and view their results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="block md:hidden">
              {/* Mobile: Stack cards instead of table */}
              {targetFilteredAssessments.length === 0 && (
                <div className="h-24 flex items-center justify-center text-center">No assessments found.</div>
              )}
              {targetFilteredAssessments.map((assessment) => (
                <div key={assessment.id} className="mb-4 rounded-lg border bg-card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{assessment.name}</span>
                    <Badge variant={getStatusBadgeVariant(assessment.status)} className={cn(assessment.status === 'IN_PROGRESS' && 'animate-pulse')}>{assessment.status}</Badge>
                    {assessment.endedEarly ? (
                      <Badge variant="secondary" className="bg-sky-500/15 text-sky-200 border border-sky-500/25">Partial</Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">{assessment.targetUrl}</div>
                  <div className="text-xs text-muted-foreground">{new Date(assessment.createdAt).toLocaleDateString()}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`font-bold ${getRiskScoreColor(assessment.riskScore)}`}>{assessment.riskScore ?? 'N/A'}</span>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/assessments/${assessment.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              {/* Desktop: Table view remains unchanged */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment Name</TableHead>
                    <TableHead className="hidden md:table-cell">Target</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right">Risk Score</TableHead>
                     <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targetFilteredAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.name}</TableCell>
                      <TableCell className="hidden md:table-cell font-mono">{assessment.targetUrl}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(assessment.status)} className={cn(assessment.status === 'IN_PROGRESS' && 'animate-pulse')}>{assessment.status}</Badge>
                          {assessment.endedEarly ? (
                            <Badge variant="secondary" className="bg-sky-500/15 text-sky-200 border border-sky-500/25">Partial</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(assessment.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className={`text-right font-bold ${getRiskScoreColor(assessment.riskScore)}`}>{assessment.riskScore ?? 'N/A'}</TableCell>
                       <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                              <Link href={`/dashboard/assessments/${assessment.id}`}>View</Link>
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter>
            <div className="text-xs text-muted-foreground">
              Showing <strong>{targetFilteredAssessments.length}</strong> of <strong>{assessments.length}</strong> assessments
            </div>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
