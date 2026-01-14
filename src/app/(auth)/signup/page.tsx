'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Lock, Mail } from '@/lib/icons';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';

const formSchema = z.object({
  name: z.string().min(2, 'Please enter your full name.').max(80, 'Name is too long.'),
  organizationName: z.string().min(2, 'Please enter your organization name.').max(80, 'Organization name is too long.'),
  email: z.string().email('Please use your corporate email address.'),
  role: z.enum(['security_analyst', 'compliance_manager', 'executive', 'administrator']),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, { message: 'You must agree to the terms.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof formSchema>;

const roles = [
  { id: 'security_analyst', title: 'Security Analyst', description: 'Hands-on vulnerability triage & remediation.' },
  { id: 'compliance_manager', title: 'Compliance Manager', description: 'Frameworks, audit readiness & reporting.' },
  { id: 'executive', title: 'Executive', description: 'Risk visibility and business impact summaries.' },
  { id: 'administrator', title: 'Administrator', description: 'Setup, access, integrations (personalization only).' },
] as const;

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { signup } = useAuth();
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
        name: '',
        organizationName: '',
            email: '',
            role: 'security_analyst',
            password: '',
            confirmPassword: '',
            terms: false,
        },
    });

    const { isSubmitting } = form.formState;

    const handleSignup = async (data: FormData) => {
        try {
            try {
              localStorage.setItem('lastAuthEmail', data.email);
              localStorage.setItem('pendingSignupEmail', data.email);
              localStorage.setItem('pendingSignupName', data.name);
              localStorage.setItem('pendingSignupOrganizationName', data.organizationName);
              localStorage.setItem('pendingSignupPersona', data.role);
            } catch {
              // ignore
            }
            await signup(data.email, data.password);
            toast({
          title: "Verify your email",
          description: "We sent you a verification link. Please check your inbox (and spam), verify your email, then log in.",
            });
        router.push(`/login?reason=email-not-verified&email=${encodeURIComponent(data.email)}`);
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: "Sign Up Failed",
                description: error.message || "An unexpected error occurred. Please try again.",
            });
        }
    };

  return (
    <Card className="w-full border-none bg-transparent shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-headline">Create Your SentinelStack Account</CardTitle>
        <CardDescription>
          Begin your 14-day free trial. No credit card required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSignup)} className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization / Workspace</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormDescription>This will be your workspace name (you can change it later).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input placeholder="security@company.com" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormDescription>Use your corporate email address.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Function</FormLabel>
                        <FormControl>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Job function">
                              {roles.map((role) => {
                                const selected = field.value === role.id;
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => field.onChange(role.id)}
                                    className={cn(
                                      'relative text-left rounded-2xl border px-5 py-5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                      'bg-gradient-to-b from-background/40 to-background/10 hover:from-background/50 hover:to-background/20',
                                      selected
                                        ? 'border-primary/60 shadow-[0_0_0_3px_rgba(59,130,246,0.25)]'
                                        : 'border-border/60'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="space-y-1">
                                        <div className="text-sm font-semibold tracking-tight">{role.title}</div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">{role.description}</div>
                                      </div>
                                      <div
                                        className={cn(
                                          'mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center',
                                          selected ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-muted/20'
                                        )}
                                      >
                                        <div className={cn('h-2.5 w-2.5 rounded-full', selected ? 'bg-primary' : 'bg-transparent')} />
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                        </FormControl>
                        <FormDescription>
                          Used to tailor onboarding. Workspace permissions are managed separately in Team settings.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input 
                                type={showPassword ? "text" : "password"} 
                                {...field} 
                                className="pl-10 pr-10"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                                {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                                </button>
                            </div>
                        </FormControl>
                         <FormDescription>Minimum 8 characters with letters and numbers.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input 
                                type={showConfirmPassword ? "text" : "password"} 
                                {...field} 
                                className="pl-10 pr-10"
                                />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                                {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                                </button>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <div className="p-4 rounded-lg bg-card border">
                <h4 className="font-semibold mb-3">Platform Access Information</h4>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    <li>Free 14-day trial with full feature access</li>
                    <li>Pre-loaded demo data for immediate exploration</li>
                    <li>Enterprise-grade security and compliance</li>
                    <li>Dedicated support during trial period</li>
                </ul>
            </div>

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                            I agree to the <Link href="#" className="text-primary underline">Terms of Service</Link> and <Link href="#" className="text-primary underline">Privacy Policy</Link>
                        </FormLabel>
                        <FormMessage />
                    </div>
                </FormItem>
              )}
            />
          
            <Button type="submit" className="w-full text-base py-6" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request SentinelStack Access
            </Button>
          </form>
        </Form>
        <div className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary underline">
            Sign in here →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
