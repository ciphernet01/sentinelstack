'use client';

import { useQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import type { Assessment, Finding } from '@prisma/client';

import { AssessmentDetails } from '@/components/assessments/AssessmentDetails';
import { usePageTitle } from '@/hooks/use-page-title';

type AssessmentPageProps = {
  params: {
    id: string;
  };
};

export type AssessmentWithDetails = Assessment & { findings: Finding[] };

export default function AssessmentPage({ params }: AssessmentPageProps) {
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get('from') === 'onboarding';

  const { data: assessment, isLoading, error } = useQuery<AssessmentWithDetails, Error>({
    queryKey: ['assessment', params.id],
    queryFn: async () => {
      const response = await api.get(`/assessments/${params.id}`);
      return response.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data as AssessmentWithDetails | undefined;
      const status = data?.status;
      const shouldPoll = status === 'IN_PROGRESS' || status === 'PENDING';
      return shouldPoll ? 3000 : false;
    },
  });

  usePageTitle(assessment?.name || 'Assessment');

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed rounded-lg bg-card mt-4">
          <p className="text-destructive-foreground font-semibold">Unable to Load Assessment</p>
          <p className="text-muted-foreground text-sm mt-2">The requested assessment could not be found or you don&apos;t have permission to view it.</p>
      </div>
    );
  }
  
  if (!assessment) {
    // This will be caught by the error boundary from react-query
    return null;
  }

  return (
    <div
      className="flex-1 px-2 py-4 sm:px-4 md:px-6 lg:px-8 w-full max-w-full"
      style={{
        maxWidth: '100vw',
        overflowX: 'hidden',
      }}
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: '600px',
        }}
      >
        <AssessmentDetails assessment={assessment} showOnboardingCta={fromOnboarding} />
      </div>
    </div>
  );
}
