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
import { ArrowLeft, ArrowRight, Loader2, Sparkles, ShieldCheck } from 'lucide-react';

type PresetKey = 'default' | 'access-control';

const presetOptions: Array<{
  key: PresetKey;
  title: string;
  description: string;
  scope: 'WEB' | 'API';
}> = [
  {
    key: 'access-control',
    title: 'Access Control QuickScan (IDOR)',
    description: 'Best first run for SaaS apps: object-level access issues, authorization gaps, and common API authz mistakes.',
    scope: 'API',
  },
  {
    key: 'default',
    title: 'Quick Baseline (Default)',
    description: 'Fast, safe baseline across core checks (CORS, JWT, IDOR). Good for a quick sanity pass.',
    scope: 'WEB',
  },
];

const formSchema = z.object({
  name: z.string().min(2, 'Assessment name must be at least 2 characters.'),
  targetUrl: z.string().url('Please enter a valid URL (e.g., https://example.com).'),
  preset: z.enum(['default', 'access-control']),
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
    onSuccess: (assessment) => {
      toast({
        title: 'Assessment Queued',
        description: 'Redirecting to live progress…',
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      router.push(`/dashboard/assessments/${assessment.id}?from=onboarding`);
    },
    onError: (error: any) => {
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
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>1) Target</CardTitle>
              <CardDescription>Tell us what you want to assess.</CardDescription>
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
              <CardTitle>2) Preset</CardTitle>
              <CardDescription>Pick a high-signal preset to run first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presetOptions.map((p) => {
                  const active = form.watch('preset') === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`text-left rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground transition ${
                        active ? 'border-primary' : 'border-muted'
                      }`}
                      onClick={() => form.setValue('preset', p.key, { shouldValidate: true })}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{p.title}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{p.description}</div>
                        </div>
                        {active && <ShieldCheck className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">Scope: {p.scope}</div>
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
