'use client';

import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { usePageTitle } from '@/hooks/use-page-title';

export default function OnboardingPage() {
  usePageTitle('Onboarding');

  return (
    <div className="p-4 sm:p-6 flex-1 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Get started</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run your first security preset in minutes. You’ll be redirected to live progress and then to a formatted report.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  );
}
