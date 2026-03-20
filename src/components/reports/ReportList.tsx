'use client';

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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileCog, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import type { Report as ReportType } from '@prisma/client';
import { saveAs } from 'file-saver';
import type { AssessmentWithReport } from '@/app/dashboard/reports/page';

type ReportListProps = {
  assessments: AssessmentWithReport[];
};

export function ReportList({ assessments }: ReportListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generatePdfMutation = useMutation<ReportType, Error, string>({
    mutationFn: (assessmentId) => api.post(`/reports/assessments/${assessmentId}/generate`).then(res => res.data.report),
    onSuccess: (data) => {
      toast({
        title: 'Report Generation Started',
        description: 'Your PDF report is being created on the server.',
      });
      // Invalidate query to refetch assessment data with the new report
      queryClient.invalidateQueries({ queryKey: ['assessmentsForReportPage'] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description: 'Could not generate the PDF on the server.',
      });
    },
  });

  const downloadPdfMutation = useMutation<ArrayBuffer, Error, string>({
    mutationFn: async (reportId) => {
      const response = await api.get<ArrayBuffer>(`/reports/${reportId}/download`, {
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf' },
      });

      // Basic magic-bytes check to prevent saving HTML/JSON as a .pdf.
      const header = new TextDecoder('ascii').decode(new Uint8Array(response.data.slice(0, 5)));
      if (header !== '%PDF-') {
        throw new Error('Downloaded file is not a valid PDF.');
      }

      return response.data;
    },
    onSuccess: (data, reportId) => {
      const blob = new Blob([data], { type: 'application/pdf' });
      saveAs(blob, `sentinel-stack-report-${reportId}.pdf`);
      toast({
        title: 'Download Started',
        description: 'Your report is being downloaded.',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Could not download the report file.',
      });
    },
  });

  const getRiskScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score > 80) return "text-red-500";
    if (score > 60) return "text-orange-500";
    if (score > 40) return "text-yellow-600";
    return "text-green-500";
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Completed Assessments</CardTitle>
        <CardDescription>
          Generate or download PDF reports for your completed security assessments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="block md:hidden">
          {/* Mobile: Stack cards instead of table */}
          {assessments.length === 0 && (
            <div className="h-24 flex items-center justify-center text-center">No completed assessments yet.</div>
          )}
          {assessments.map((assessment) => (
            <div key={assessment.id} className="mb-4 rounded-lg border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{assessment.name}</span>
                {assessment.endedEarly ? (
                  <Badge variant="secondary" className="bg-sky-500/15 text-sky-200 border border-sky-500/25">Partial</Badge>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground font-mono break-all">{assessment.targetUrl}</div>
              <div className="text-xs text-muted-foreground">{new Date(assessment.updatedAt).toLocaleDateString()}</div>
              <div className="flex items-center justify-between mt-2">
                <span className={`font-bold ${getRiskScoreColor(assessment.riskScore)}`}>{assessment.riskScore ?? 'N/A'}</span>
                <div className="flex gap-2">
                  {assessment.report ? (
                    <Button size="sm" onClick={() => downloadPdfMutation.mutate(assessment.report!.id)} disabled={downloadPdfMutation.isPending && downloadPdfMutation.variables === assessment.report.id}>
                      {downloadPdfMutation.isPending && downloadPdfMutation.variables === assessment.report.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => generatePdfMutation.mutate(assessment.id)} disabled={generatePdfMutation.isPending && generatePdfMutation.variables === assessment.id}>
                      {generatePdfMutation.isPending && generatePdfMutation.variables === assessment.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileCog className="mr-2 h-4 w-4" />
                      )}
                      Generate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          {/* Desktop: Table view remains unchanged */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead className="hidden md:table-cell">Target</TableHead>
                <TableHead className="hidden md:table-cell">Completed On</TableHead>
                <TableHead className="text-right">Risk Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No completed assessments yet.
                  </TableCell>
                </TableRow>
              )}
              {assessments.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{assessment.name}</span>
                      {assessment.endedEarly ? (
                        <Badge variant="secondary" className="bg-sky-500/15 text-sky-200 border border-sky-500/25">Partial</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono">{assessment.targetUrl}</TableCell>
                  <TableCell className="hidden md:table-cell">{new Date(assessment.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell className={`text-right font-bold ${getRiskScoreColor(assessment.riskScore)}`}>{assessment.riskScore ?? 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {assessment.report ? (
                      <Button size="sm" onClick={() => downloadPdfMutation.mutate(assessment.report!.id)} disabled={downloadPdfMutation.isPending && downloadPdfMutation.variables === assessment.report.id}>
                        {downloadPdfMutation.isPending && downloadPdfMutation.variables === assessment.report.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => generatePdfMutation.mutate(assessment.id)} disabled={generatePdfMutation.isPending && generatePdfMutation.variables === assessment.id}>
                        {generatePdfMutation.isPending && generatePdfMutation.variables === assessment.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileCog className="mr-2 h-4 w-4" />
                        )}
                        Generate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
