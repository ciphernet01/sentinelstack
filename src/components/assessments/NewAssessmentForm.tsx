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
import { ArrowLeft, ArrowRight, Loader2, Sparkles, ChevronDown, ChevronUp, Settings2, ShieldCheck } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const formSchema = z.object({
  name: z.string().min(2, 'Assessment name must be at least 2 characters.'),
  targetUrl: z.string().url('Please enter a valid URL (e.g., https://example.com).'),
  scope: z.enum(['WEB', 'API', 'AUTH', 'FULL']),
  toolPreset: z.enum(['default', 'access-control', 'deep', 'enterprise']),
  authorizationConfirmed: z.boolean().refine(val => val === true, { message: 'You must confirm you have permission to scan this target.' }),
  notes: z.string().optional(),
  // Advanced scan options for authenticated scanning
  cookies: z.string().optional(),
  customHeaders: z.string().optional(), // JSON string of headers object
  assessmentProfile: z.object({
    environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'OTHER']),
    businessCriticality: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
    dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'REGULATED']),
    rateLimitProfile: z.enum(['CONSERVATIVE', 'STANDARD', 'AGGRESSIVE']),
    complianceFrameworks: z.array(z.enum(['SOC2', 'ISO27001', 'PCI_DSS', 'HIPAA', 'GDPR', 'NIST_CSF', 'CIS', 'RBI', 'SEBI'])),
    authorizedBy: z.string().max(160).optional(),
    authorizationTicket: z.string().max(160).optional(),
    emergencyContact: z.string().max(200).optional(),
    testWindowStart: z.string().optional(),
    testWindowEnd: z.string().optional(),
    outOfScope: z.string().max(4000).optional(),
  }),
}).superRefine((data, ctx) => {
  if (data.customHeaders?.trim()) {
    try {
      const parsed = JSON.parse(data.customHeaders);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customHeaders'], message: 'Headers must be a JSON object.' });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customHeaders'], message: 'Headers must be valid JSON.' });
    }
  }

  if (data.assessmentProfile.testWindowStart && data.assessmentProfile.testWindowEnd) {
    const startsAt = new Date(data.assessmentProfile.testWindowStart).getTime();
    const endsAt = new Date(data.assessmentProfile.testWindowEnd).getTime();
    if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt <= startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assessmentProfile', 'testWindowEnd'], message: 'End time must be after start time.' });
    }
  }
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
      notes: '',
      cookies: '',
      customHeaders: '',
      assessmentProfile: {
        environment: 'PRODUCTION',
        businessCriticality: 'HIGH',
        dataClassification: 'CONFIDENTIAL',
        rateLimitProfile: 'CONSERVATIVE',
        complianceFrameworks: ['SOC2', 'ISO27001'],
        authorizedBy: '',
        authorizationTicket: '',
        emergencyContact: '',
        testWindowStart: '',
        testWindowEnd: '',
        outOfScope: '',
      },
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
      // Transform form data to API format with scanOptions
      const { cookies, customHeaders, assessmentProfile, ...baseData } = newAssessment;
      
      // Build scanOptions object only if values are provided
      const scanOptions: Record<string, unknown> = {};
      if (cookies?.trim()) {
        scanOptions.cookies = cookies.trim();
      }
      if (customHeaders?.trim()) {
        try {
          scanOptions.headers = JSON.parse(customHeaders);
        } catch {
          // Invalid JSON, ignore headers
        }
      }
      
      const payload = {
        ...baseData,
        assessmentProfile,
        ...(Object.keys(scanOptions).length > 0 && { scanOptions }),
      };
      
      return api.post('/assessments', payload);
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
      const errorCode = error.response?.data?.code;
      const upgradeUrl = error.response?.data?.upgradeUrl;
      
      // Handle scan limit reached error specially
      if (errorCode === 'SCAN_LIMIT_REACHED') {
        toast({
          variant: 'destructive',
          title: "Scan Limit Reached",
          description: error.response?.data?.message || "You've reached your monthly scan limit.",
          action: upgradeUrl ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push(upgradeUrl)}
              className="border-white/20 hover:bg-white/10"
            >
              Upgrade Plan
            </Button>
          ) : undefined,
        });
        return;
      }
      
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

                <EnterpriseAssessmentProfile control={control} />

                {/* Advanced Options for Authenticated Scanning */}
                <AdvancedScanOptions control={control} />
            </CardContent>
        </>
    );
}

const frameworkOptions = [
  { value: 'SOC2', label: 'SOC 2' },
  { value: 'ISO27001', label: 'ISO 27001' },
  { value: 'PCI_DSS', label: 'PCI DSS' },
  { value: 'HIPAA', label: 'HIPAA' },
  { value: 'GDPR', label: 'GDPR' },
  { value: 'NIST_CSF', label: 'NIST CSF' },
  { value: 'CIS', label: 'CIS Controls' },
  { value: 'RBI', label: 'RBI' },
  { value: 'SEBI', label: 'SEBI' },
] as const;

function EnterpriseAssessmentProfile({ control }: { control: any }) {
  const [isOpen, setIsOpen] = useState(true);
  const { setValue, watch } = useFormContext<FormData>();
  const selectedFrameworks = watch('assessmentProfile.complianceFrameworks') || [];

  const toggleFramework = (value: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedFrameworks, value]))
      : selectedFrameworks.filter((item: string) => item !== value);

    setValue('assessmentProfile.complianceFrameworks', next as any, { shouldDirty: true, shouldTouch: true });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
      <CollapsibleTrigger asChild>
        <Button variant="outline" type="button" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Enterprise Assessment Profile
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-5 rounded-md border bg-muted/30 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={control}
            name="assessmentProfile.environment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Environment</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PRODUCTION">Production</SelectItem>
                    <SelectItem value="STAGING">Staging</SelectItem>
                    <SelectItem value="DEVELOPMENT">Development</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="assessmentProfile.businessCriticality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Criticality</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MODERATE">Moderate</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="assessmentProfile.dataClassification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data Classification</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="INTERNAL">Internal</SelectItem>
                    <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                    <SelectItem value="REGULATED">Regulated</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="assessmentProfile.rateLimitProfile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Traffic Posture</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CONSERVATIVE">Conservative</SelectItem>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="AGGRESSIVE">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <Label>Compliance Mapping</Label>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {frameworkOptions.map((framework) => (
              <label key={framework.value} className="flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={selectedFrameworks.includes(framework.value)}
                  onCheckedChange={(checked) => toggleFramework(framework.value, checked === true)}
                />
                <span>{framework.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={control}
            name="assessmentProfile.authorizedBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorized By</FormLabel>
                <FormControl><Input placeholder="Security owner or approver" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="assessmentProfile.authorizationTicket"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorization Ticket</FormLabel>
                <FormControl><Input placeholder="Jira, GRC, or contract reference" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="assessmentProfile.testWindowStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Window Start</FormLabel>
                <FormControl><Input type="datetime-local" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="assessmentProfile.testWindowEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Window End</FormLabel>
                <FormControl><Input type="datetime-local" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name="assessmentProfile.emergencyContact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency Contact</FormLabel>
              <FormControl><Input placeholder="Name, email, phone, or escalation channel" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="assessmentProfile.outOfScope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Out-of-Scope Systems</FormLabel>
              <FormControl>
                <Textarea placeholder="Domains, paths, APIs, destructive tests, or user roles excluded from this engagement" rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function AdvancedScanOptions({ control }: { control: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
      <CollapsibleTrigger asChild>
        <Button variant="outline" type="button" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Advanced Options (Authenticated Scanning)
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4 rounded-md border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Configure authentication to scan protected areas of your application. These credentials are used only during the scan and are not stored.
        </p>
        
        <FormField
          control={control}
          name="cookies"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Session Cookies</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="session=abc123; csrftoken=xyz789; auth_token=..." 
                  className="font-mono text-sm"
                  rows={2}
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Enter cookies to authenticate requests. Format: <code className="text-xs bg-muted px-1 rounded">key=value; key2=value2</code>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="customHeaders"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Headers (JSON)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={'{\n  "Authorization": "Bearer eyJhbGc...",\n  "X-API-Key": "your-api-key"\n}'}
                  className="font-mono text-sm"
                  rows={4}
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Add custom HTTP headers as a JSON object. Useful for API keys, bearer tokens, or custom auth headers.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
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
    const profile = values.assessmentProfile || {};

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
                    <div className="grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Environment</span>
                        <p className="font-semibold">{String(profile.environment || '').replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Business Criticality</span>
                        <p className="font-semibold">{String(profile.businessCriticality || '').replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data Classification</span>
                        <p className="font-semibold">{String(profile.dataClassification || '').replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Traffic Posture</span>
                        <p className="font-semibold">{String(profile.rateLimitProfile || '').replace('_', ' ')}</p>
                      </div>
                    </div>
                    {profile.complianceFrameworks?.length > 0 && (
                      <div className="flex flex-col text-sm">
                        <span className="text-muted-foreground">Compliance Mapping</span>
                        <p className="mt-1 font-semibold">{profile.complianceFrameworks.join(', ')}</p>
                      </div>
                    )}
                    {(profile.authorizedBy || profile.authorizationTicket || profile.emergencyContact) && (
                      <div className="grid gap-2 border-t pt-3 text-sm">
                        {profile.authorizedBy && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Authorized By</span>
                            <span className="font-semibold text-right">{profile.authorizedBy}</span>
                          </div>
                        )}
                        {profile.authorizationTicket && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Authorization Ticket</span>
                            <span className="font-semibold text-right">{profile.authorizationTicket}</span>
                          </div>
                        )}
                        {profile.emergencyContact && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Emergency Contact</span>
                            <span className="font-semibold text-right">{profile.emergencyContact}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {values.notes && (
                         <div className="flex flex-col text-sm">
                            <span className="text-muted-foreground">Notes</span>
                            <p className="mt-1 font-sans text-foreground whitespace-pre-wrap">{values.notes}</p>
                        </div>
                    )}
                    {(values.cookies || values.customHeaders) && (
                        <div className="flex flex-col text-sm border-t pt-3 mt-3">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <Settings2 className="h-3 w-3" />
                              Advanced Options
                            </span>
                            {values.cookies && (
                              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Session cookies configured</p>
                            )}
                            {values.customHeaders && (
                              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Custom headers configured</p>
                            )}
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
    
