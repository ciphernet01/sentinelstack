'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notFound, useRouter } from 'next/navigation';
import { Loader2, Download, FileCheck } from 'lucide-react';
import api from '@/lib/api';
import type { Assessment, Finding, Report as ReportType } from '@prisma/client';
import { saveAs } from 'file-saver';

import Report from '@/components/report/Report';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

type AssessmentPageProps = {
  params: {
    id: string;
  };
};

export type AssessmentWithDetails = Assessment & { findings: Finding[], report: ReportType | null };

export default function ReportPage({ params }: AssessmentPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assessment, isLoading, error } = useQuery<AssessmentWithDetails, Error>({
    queryKey: ['assessmentForReport', params.id],
    queryFn: async () => {
      const response = await api.get(`/assessments/${params.id}`);
      return response.data;
    },
  });

  const generatePdfMutation = useMutation<ReportType, Error, string>({
    mutationFn: (assessmentId) => api.post(`/reports/assessments/${assessmentId}/generate`).then(res => res.data.report),
    onSuccess: () => {
      toast({
        title: 'Report Generated',
        description: 'Your PDF report is ready for download.',
      });
      // Invalidate the query to refetch the assessment with the new report data
      queryClient.invalidateQueries({ queryKey: ['assessmentForReport', params.id] });
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


  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-800" />
      </div>
    );
  }

  if (error || !assessment) {
    notFound();
  }

  const handleGenerate = () => {
    generatePdfMutation.mutate(assessment.id);
  };
  
  const handleDownload = () => {
      if(assessment.report?.id) {
          downloadPdfMutation.mutate(assessment.report.id);
      }
  }

  return (
    <>
      {/* This control panel will be hidden during printing */}
      <div className="fixed top-4 right-4 z-50 print:hidden space-x-2">
        <Button onClick={handleGenerate} disabled={generatePdfMutation.isPending}>
          {generatePdfMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {assessment.report ? 'Regenerate PDF' : 'Generate PDF'}
        </Button>
        {assessment.report && (
             <Button onClick={handleDownload} disabled={downloadPdfMutation.isPending}>
                {downloadPdfMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download PDF
            </Button>
        )}
         <Button variant="outline" onClick={() => window.print()}>
            Print Preview
        </Button>
      </div>
      
      {/* The Report component is what gets printed */}
      <Report assessment={assessment} />

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 1.5cm;
          }
          .break-before-page {
            page-break-before: always;
          }
          .break-after-page {
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}
