'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCompleteOnboarding } from '@/hooks/use-onboarding';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, ShieldCheck, Zap, Shield, Lock, Globe } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type PresetKey = 'default' | 'access-control' | 'api-security' | 'full-scan';

const presetOptions: Array<{
  key: PresetKey;
  title: string;
  description: string;
  scope: 'WEB' | 'API';
  duration: string;
  icon: React.ReactNode;
  recommended?: boolean;
}> = [
  {
    key: 'access-control',
    title: 'Access Control QuickScan',
    description: 'IDOR vulnerabilities, authorization gaps, and API authz mistakes. Perfect for SaaS apps.',
    scope: 'API',
    duration: '~3 min',
    icon: <Lock className="h-5 w-5" />,
    recommended: true,
  },
  {
    key: 'default',
    title: 'Quick Baseline',
    description: 'Fast, safe baseline across core checks (CORS, JWT, IDOR). Good for a quick sanity pass.',
    scope: 'WEB',
    duration: '~2 min',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    key: 'api-security',
    title: 'API Security Scan',
    description: 'Comprehensive API testing: auth bypasses, rate limiting, injection points.',
    scope: 'API',
    duration: '~5 min',
    icon: <Globe className="h-5 w-5" />,
  },
  {
    key: 'full-scan',
    title: 'Full Security Audit',
    description: 'Complete assessment with all 30+ tools. Best for pre-release or compliance audits.',
    scope: 'WEB',
    duration: '~10 min',
    icon: <Shield className="h-5 w-5" />,
  },
];

const formSchema = z.object({
  name: z.string().min(2, 'Assessment name must be at least 2 characters.'),
  targetUrl: z.string().url('Please enter a valid URL (e.g., https://example.com).'),
  preset: z.enum(['default', 'access-control', 'api-security', 'full-scan']),
  authorizationConfirmed: z.boolean().refine((v) => v === true, {
    message: 'You must confirm you have permission to scan this target.',
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function OnboardingWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const completeOnboarding = useCompleteOnboarding();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: 'My First Assessment',
      targetUrl: '',
      preset: 'access-control',
      authorizationConfirmed: false,
    },
  });

  const presetKey = form.watch('preset');
  const progressValue = step === 1 ? 33 : step === 2 ? 66 : 100;

  const selectedPreset = useMemo(() => {
    return presetOptions.find((p) => p.key === presetKey) ?? presetOptions[0];
  }, [presetKey]);

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const body = {
        name: values.name,
        targetUrl: values.targetUrl,
        scope: selectedPreset.scope,
        toolPreset: values.preset,
        authorizationConfirmed: values.authorizationConfirmed,
        notes: 'Created via onboarding wizard.',
      };
      return api.post('/assessments', body).then((r) => r.data);
    },
    onSuccess: async (assessment) => {
      // Mark onboarding as complete
      await completeOnboarding.mutateAsync();
      
      toast({
        title: 'Assessment Queued',
        description: 'Redirecting to live progress…',
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      router.push(`/dashboard/assessments/${assessment.id}?from=onboarding`);
    },
    onError: (error: any) => {
      const errorCode = error.response?.data?.errorCode;
      if (errorCode === 'SCAN_LIMIT_REACHED') {
        toast({
          variant: 'destructive',
          title: 'Scan limit reached',
          description: 'Upgrade your plan to continue scanning.',
        });
        router.push('/dashboard/settings/billing');
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Failed to start assessment',
        description: error.response?.data?.message || error.message || 'An unexpected error occurred.',
      });
    },
  });

  const goNext = async () => {
    const fields = step === 1 ? (['name', 'targetUrl'] as const) : step === 2 ? (['preset'] as const) : ([] as const);
    const ok = await form.trigger(fields as any);
    if (ok) setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3));
  };

  const goBack = () => setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : 1));

  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form onSubmit={submit}>
      <Card className="w-full max-w-xl mx-auto">
        {/* Progress indicator */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Step {step} of 3</span>
            <span>{step === 1 ? 'Target' : step === 2 ? 'Preset' : 'Confirm'}</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>What do you want to scan?</CardTitle>
              <CardDescription>Enter the URL of your application or API endpoint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Assessment name</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name?.message && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetUrl">Target URL</Label>
                <Input id="targetUrl" placeholder="https://app.example.com" {...form.register('targetUrl')} />
                {form.formState.errors.targetUrl?.message && (
                  <p className="text-sm text-destructive">{form.formState.errors.targetUrl.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Tip: if scanning a local dev server from Docker, use the host-reachable URL (e.g., `http://host.docker.internal:3000`).
                </p>
              </div>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Choose a scan preset</CardTitle>
              <CardDescription>Select the type of security assessment to run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {presetOptions.map((p) => {
                  const active = form.watch('preset') === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`text-left rounded-lg border-2 p-4 hover:bg-accent/50 transition-all ${
                        active ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                      }`}
                      onClick={() => form.setValue('preset', p.key, { shouldValidate: true })}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-md ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {p.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{p.title}</span>
                            {p.recommended && (
                              <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Scope: {p.scope}</span>
                            <span>Duration: {p.duration}</span>
                          </div>
                        </div>
                        {active && <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>3) Confirm</CardTitle>
              <CardDescription>
                Confirm authorization, then we’ll queue the assessment and take you to live progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md border p-4 bg-card space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Target:</span>{' '}
                  <span className="font-medium break-words">{form.watch('targetUrl') || '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Preset:</span>{' '}
                  <span className="font-medium">{selectedPreset.title}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md border p-4">
                <Checkbox
                  checked={form.watch('authorizationConfirmed')}
                  onCheckedChange={(v) => form.setValue('authorizationConfirmed', Boolean(v), { shouldValidate: true })}
                />
                <div>
                  <div className="text-sm font-medium">
                    I confirm I have explicit permission to perform security testing on this target.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Unauthorized scanning is illegal and violates the terms of service.
                  </div>
                  {form.formState.errors.authorizationConfirmed?.message && (
                    <p className="text-sm text-destructive mt-2">{form.formState.errors.authorizationConfirmed.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </>
        )}

        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={goBack} disabled={mutation.isPending}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button type="button" onClick={goNext}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {mutation.isPending ? 'Starting…' : 'Start Assessment'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}
