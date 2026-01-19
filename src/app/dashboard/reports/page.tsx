'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Assessment } from '@prisma/client';
import { Loader2 } from 'lucide-react';
import { ReportList } from '@/components/reports/ReportList';
import { usePageTitle } from '@/hooks/use-page-title';

export type AssessmentWithReport = Assessment & { report: { id: string } | null };

export default function ReportsPage() {
  usePageTitle('Reports');

  const { data: assessments, isLoading, error } = useQuery<AssessmentWithReport[], Error>({
    queryKey: ['assessmentsForReportPage'],
    queryFn: async () => {
      const response = await api.get('/assessments');
      return response.data;
    },
  });

  const completedAssessments = assessments?.filter(a => a.status === 'COMPLETED');

  return (
    <div className="p-6 flex-1">
      <div className="flex items-center mb-6">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Reports & Exports</h1>
      </div>

      {isLoading && (
        <div className="flex h-full w-full items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed rounded-lg bg-card mt-4">
          <p className="text-destructive-foreground font-semibold">Unable to Load Reports</p>
          <p className="text-muted-foreground text-sm mt-2">Could not fetch assessment data from the backend.</p>
        </div>
      )}

      {completedAssessments && <ReportList assessments={completedAssessments} />}
    </div>
  );
}
