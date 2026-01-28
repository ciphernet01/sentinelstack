'use client';

import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { PlusCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { AssessmentListClient } from "@/components/assessments/AssessmentListClient";
import api from "@/lib/api";
import type { Assessment } from "@prisma/client";
import { usePageTitle } from '@/hooks/use-page-title';

export default function AssessmentsPage() {
  usePageTitle('Assessments');

  const searchParams = useSearchParams();
  const targetFilter = searchParams.get('target');

  const { data: assessments, isLoading, error } = useQuery<Assessment[], Error>({
    queryKey: ['assessments'],
    queryFn: async () => {
      const response = await api.get('/assessments');
      return response.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data as Assessment[] | undefined;
      const shouldPoll = (data ?? []).some(
        (a) => a.status === 'IN_PROGRESS' || a.status === 'PENDING'
      );
      return shouldPoll ? 3000 : false;
    },
  });

  return (
    <div className="p-3 sm:p-6 flex-1">
      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-0">
        <h1 className="text-base sm:text-lg font-semibold md:text-2xl font-headline">Assessments</h1>
        <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href="/dashboard/assessments/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Assessment
            </Link>
          </Button>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center p-8 sm:p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center text-center p-8 sm:p-16 border-2 border-dashed rounded-lg bg-card mt-4">
            <p className="text-destructive-foreground font-semibold">Unable to Load Assessments</p>
            <p className="text-muted-foreground text-sm mt-2">Could not fetch data from the backend.</p>
        </div>
      )}

      {assessments && <AssessmentListClient assessments={assessments} targetFilter={targetFilter} />}
    </div>
  );
}
