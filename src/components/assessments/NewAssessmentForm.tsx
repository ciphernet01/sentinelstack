'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, 'Assessment name must be at least 2 characters.'),
  targetUrl: z.string().url('Please enter a valid URL (e.g., https://example.com).'),
  scope: z.enum(['WEB', 'API', 'AUTH', 'FULL']),
  toolPreset: z.enum(['default', 'access-control', 'deep', 'enterprise']),
  authorizationConfirmed: z.boolean().refine(val => val === true, { message: 'You must confirm you have permission to scan this target.' }),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function NewAssessmentForm() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      targetUrl: '',
      scope: 'WEB',
      toolPreset: 'default',
      authorizationConfirmed: false,
      notes: ''
    },
  });

  useEffect(() => {
    const raw = searchParams.get('target');
    const target = String(raw ?? '').trim();
    if (!target) return;

    const currentTarget = String(form.getValues('targetUrl') ?? '').trim();
    if (!currentTarget) {
      form.setValue('targetUrl', target, { shouldDirty: true, shouldTouch: true });
    }

    const currentName = String(form.getValues('name') ?? '').trim();
    if (!currentName) {
      try {
        const u = new URL(target);
        const suggested = `Scan ${u.hostname}`;
        form.setValue('name', suggested, { shouldDirty: true, shouldTouch: true });
      } catch {
        // ignore invalid URL; user will correct
      }
    }
  }, [searchParams, form]);

  useEffect(() => {
    const preset = String(searchParams.get('toolPreset') ?? '').trim();
    const scope = String(searchParams.get('scope') ?? '').trim();

    if (preset) {
      const current = form.getValues('toolPreset');
      if (current === 'default') {
        if (preset === 'access-control' || preset === 'deep' || preset === 'enterprise' || preset === 'default') {
          form.setValue('toolPreset', preset as any, { shouldDirty: true, shouldTouch: true });
        }
      }
    }

    if (scope) {
      const current = form.getValues('scope');
      if (current === 'WEB') {
        if (scope === 'WEB' || scope === 'API' || scope === 'AUTH' || scope === 'FULL') {
          form.setValue('scope', scope as any, { shouldDirty: true, shouldTouch: true });
        }
      }
    }
  }, [searchParams, form]);

  const { trigger } = form;

  const mutation = useMutation({
    mutationFn: (newAssessment: FormData) => {
      return api.post('/assessments', newAssessment);
    },
    onSuccess: (data) => {
      toast({
        title: "Assessment Queued",
        description: `"${data.data.name}" is now in the queue.`,
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      router.push('/dashboard/assessments');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: "Failed to Start Assessment",
        description: error.response?.data?.message || error.message || "An unexpected error occurred.",
      });
    }
  });

  const handleNext = async () => {
    const isValid = await trigger(step === 1 ? ['name', 'targetUrl'] : []);
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="w-full max-w-xl mx-auto">
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            {step > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
            ) : <div />}
            
            {step < 3 && <Button type="button" onClick={handleNext}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>}
            
            {step === 3 && (
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {mutation.isPending ? 'Queuing Assessment...' : 'Start Assessment'}
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

function Step1() {
  const { control } = useFormContext();
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>Assessment Scope</CardTitle>
        <CardDescription>Enter the details for the new security assessment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assessment Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corp Q3 Web Audit" {...field} />
              </FormControl>
               <FormDescription>A descriptive name for this assessment.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="targetUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target URL</FormLabel>
              <FormControl>
                <Input placeholder="https://acme.com" {...field} />
              </FormControl>
              <FormDescription>The root URL of the target to be scanned.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </>
  );
}

function Step2() {
    const { control, watch } = useFormContext();
    const scope = watch('scope');

    return (
        <>
            <CardHeader>
                <CardTitle>Tool Configuration</CardTitle>
                <CardDescription>Select the scope of tools to be used for this assessment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField
                    control={control}
                    name="scope"
                    render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel className="block text-center">Assessment Scope</FormLabel>
                        <FormControl>
                        <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                            <FormItem>
                                <FormControl>
                                    <RadioGroupItem value="WEB" id="scope-web" className="sr-only" />
                                </FormControl>
                                <Label htmlFor="scope-web" className={`flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground ${field.value === 'WEB' ? 'border-primary': ''}`}>
                                    <h3 className="font-semibold">Web Application</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Standard scan covering OWASP Top 10 vulnerabilities like XSS, SQLi, and misconfigurations.</p>
                                </Label>
                            </FormItem>
                            <FormItem>
                                <FormControl>
                                    <RadioGroupItem value="API" id="scope-api" className="sr-only" />
                                </FormControl>
                                <Label htmlFor="scope-api" className={`flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground ${field.value === 'API' ? 'border-primary': ''}`}>
                                    <h3 className="font-semibold">API Security</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Focuses on API-specific vulnerabilities like broken object level authorization and excessive data exposure.</p>
                                </Label>
                            </FormItem>
                            <FormItem>
                                <FormControl>
                                    <RadioGroupItem value="AUTH" id="scope-auth" className="sr-only" />
                                </FormControl>
                                <Label htmlFor="scope-auth" className={`flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground ${field.value === 'AUTH' ? 'border-primary': ''}`}>
                                    <h3 className="font-semibold">Authentication</h3>
                                    <p className="text-sm text-muted-foreground mt-1">In-depth analysis of authentication and session management mechanisms for weaknesses.</p>
                                </Label>
                            </FormItem>
                             <FormItem>
                                <FormControl>
                                    <RadioGroupItem value="FULL" id="scope-full" className="sr-only" />
                                </FormControl>
                                <Label htmlFor="scope-full" className={`flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground ${field.value === 'FULL' ? 'border-primary': ''}`}>
                                    <h3 className="font-semibold">Full Stack</h3>
                                    <p className="text-sm text-muted-foreground mt-1">The most comprehensive scan, combining all available toolsets for a deep-dive analysis.</p>
                                </Label>
                            </FormItem>
                        </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                  <FormField
                    control={control}
                    name="toolPreset"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tool Preset</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a tool preset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default (safe baseline)</SelectItem>
                              <SelectItem value="access-control">Access Control QuickScan (IDOR)</SelectItem>
                              <SelectItem value="deep">Deep (expanded checks)</SelectItem>
                              <SelectItem value="enterprise">Enterprise (heavy tools)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Use Enterprise only when you have explicit authorization and expect longer, more intensive scans.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                 <FormField
                    control={control}
                    name="notes"
                    render={({ field }) => (
                    <FormItem className="mt-6">
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                        <Textarea placeholder="e.g., focus on checkout flow, credentials for testing are test@example.com/password" {...field} />
                        </FormControl>
                        <FormDescription>Provide any specific instructions or test credentials here.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
        </>
    );
}

function Step3() {
    const { control, watch } = useFormContext();
    const values = watch();

    const scopeMap: Record<string, string> = {
        WEB: "Web Application",
        API: "API Security",
        AUTH: "Authentication",
        FULL: "Full Stack"
    };

    const toolPresetMap: Record<string, string> = {
      default: "Default",
      'access-control': 'Access Control QuickScan (IDOR)',
      deep: "Deep",
      enterprise: "Enterprise",
    };

    return (
        <>
            <CardHeader>
                <CardTitle>Confirmation</CardTitle>
                <CardDescription>Review the details before starting the assessment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4 rounded-md border bg-card p-4">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Assessment Name</span>
                        <span className="font-semibold">{values.name}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Target URL</span>
                        <span className="font-mono text-sm">{values.targetUrl}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Assessment Scope</span>
                        <span className="font-semibold">{scopeMap[values.scope]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tool Preset</span>
                      <span className="font-semibold">{toolPresetMap[values.toolPreset]}</span>
                    </div>
                    {values.notes && (
                         <div className="flex flex-col text-sm">
                            <span className="text-muted-foreground">Notes</span>
                            <p className="mt-1 font-sans text-foreground whitespace-pre-wrap">{values.notes}</p>
                        </div>
                    )}
                </div>
               
                <FormField
                    control={control}
                    name="authorizationConfirmed"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-card">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                I confirm I have explicit, written permission to perform security testing on the specified target.
                                </FormLabel>
                                <FormDescription>
                                Unauthorized scanning is illegal and a direct violation of our terms of service.
                                </FormDescription>
                                 <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />
            </CardContent>
        </>
    );
}
    