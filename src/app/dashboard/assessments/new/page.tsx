'use client';

import { NewAssessmentForm } from "@/components/assessments/NewAssessmentForm";
import { usePageTitle } from '@/hooks/use-page-title';

export default function NewAssessmentPage() {
  usePageTitle('New Assessment');

  return (
    <div className="p-6 flex-1 max-w-4xl mx-auto">
      <div className="flex items-center justify-center mb-6">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">New Security Assessment</h1>
      </div>
      <NewAssessmentForm />
    </div>
  );
}
