'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, BarChart3, FileCheck2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/hooks/use-page-title';
import { Eye, EyeOff, Lock, Mail } from '@/lib/icons';
import { Checkbox } from '@/components/ui/checkbox';
import styles from '@/components/auth/AuthPage.module.css';

const formSchema = z.object({
  name: z.string().min(2, 'Please enter your full name.').max(80, 'Name is too long.'),
  organizationName: z.string().min(2, 'Please enter your organization name.').max(80, 'Organization name is too long.'),
  email: z.string().email('Please use your corporate email address.'),
  role: z.enum(['security_analyst', 'compliance_manager', 'executive', 'administrator']),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, { message: 'You must agree to the terms.' }),
}).refine(data => data.password === data.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type FormData = z.infer<typeof formSchema>;
const roles = [
  { id: 'security_analyst', title: 'Security Analyst', description: 'Hands-on vulnerability triage & remediation.' },
  { id: 'compliance_manager', title: 'Compliance Manager', description: 'Frameworks, audit readiness & reporting.' },
  { id: 'executive', title: 'Executive', description: 'Risk visibility and business impact summaries.' },
  { id: 'administrator', title: 'Administrator', description: 'Setup, access, integrations (personalization only).' },
] as const;

export default function SignupPage() {
  usePageTitle('Sign Up');
  const router = useRouter();
  const { toast } = useToast();
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', organizationName: '', email: '', role: 'security_analyst', password: '', confirmPassword: '', terms: false },
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
      } catch {}
      await signup(data.email, data.password);
      toast({ title: 'Verify your email', description: 'We sent you a verification link. Please check your inbox (and spam), verify your email, then log in.' });
      router.push(`/login?reason=email-not-verified&email=${encodeURIComponent(data.email)}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message || 'An unexpected error occurred. Please try again.' });
    }
  };

  return (
    <div className={styles.gridSignup}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> Start securing</div>
        <h1 className={`${styles.title} ${styles.signupTitle}`}>Build your security workspace.</h1>
        <p className={styles.subtitle}>Create a SentinelStack account and bring continuous security assessment, compliance mapping and business-risk visibility into one workspace.</p>
        <div className={styles.points}>
          <div className={styles.point}><span className={styles.pointIcon}><ShieldCheck size={15} /></span><span>Run security assessments across your application stack.</span></div>
          <div className={styles.point}><span className={styles.pointIcon}><BarChart3 size={15} /></span><span>Translate technical findings into business impact and risk.</span></div>
          <div className={styles.point}><span className={styles.pointIcon}><FileCheck2 size={15} /></span><span>Generate reports and map findings to compliance frameworks.</span></div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Create your account</h2>
          <p className={styles.cardDescription}>Set up your workspace. No credit card required.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSignup)} className={styles.form}>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className={styles.field}>
                  <FormLabel className={styles.fieldLabel}>Full name</FormLabel>
                  <FormControl><Input placeholder="Your name" {...field} className={styles.input} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="organizationName" render={({ field }) => (
                <FormItem className={styles.field}>
                  <FormLabel className={styles.fieldLabel}>Organization / workspace</FormLabel>
                  <FormControl><Input placeholder="Company name" {...field} className={styles.input} /></FormControl>
                  <FormDescription className={styles.helper}>You can change this later.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem className={styles.field}>
                <FormLabel className={styles.fieldLabel}>Email address</FormLabel>
                <FormControl><div className={styles.inputWrap}><Mail className={styles.inputIcon} size={18} /><Input placeholder="security@company.com" {...field} className={`${styles.input} ${styles.inputWithIcon}`} /></div></FormControl>
                <FormDescription className={styles.helper}>Use your corporate email address.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem className={styles.field}>
                <FormLabel className={styles.fieldLabel}>Job function</FormLabel>
                <FormControl>
                  <div className={styles.roleGrid} role="radiogroup" aria-label="Job function">
                    {roles.map(role => {
                      const selected = field.value === role.id;
                      return (
                        <button key={role.id} type="button" role="radio" aria-checked={selected} onClick={() => field.onChange(role.id)} className={`${styles.role} ${selected ? styles.roleSelected : ''}`}>
                          <div className={styles.roleTop}><div className={styles.roleTitle}>{role.title}</div><span className={styles.radio} /></div>
                          <div className={styles.roleDescription}>{role.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
                <FormDescription className={styles.helper}>Used to tailor onboarding. Workspace permissions are managed separately.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-5 md:grid-cols-2">
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem className={styles.field}>
                  <FormLabel className={styles.fieldLabel}>Password</FormLabel>
                  <FormControl><div className={styles.inputWrap}><Lock className={styles.inputIcon} size={18} /><Input type={showPassword ? 'text' : 'password'} {...field} className={`${styles.input} ${styles.inputWithIcon} ${styles.passwordInput}`} /><button type="button" className={styles.eye} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></FormControl>
                  <FormDescription className={styles.helper}>Minimum 8 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem className={styles.field}>
                  <FormLabel className={styles.fieldLabel}>Confirm password</FormLabel>
                  <FormControl><div className={styles.inputWrap}><Lock className={styles.inputIcon} size={18} /><Input type={showConfirmPassword ? 'text' : 'password'} {...field} className={`${styles.input} ${styles.inputWithIcon} ${styles.passwordInput}`} /><button type="button" className={styles.eye} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className={styles.accessInfo}>
              <h4 className={styles.accessTitle}>Platform access</h4>
              <ul className={styles.accessList}>
                <li>Free 14-day trial with full feature access</li>
                <li>Customer-owned assessment data</li>
                <li>Enterprise-grade security and compliance</li>
                <li>Dedicated support during the trial period</li>
              </ul>
            </div>

            <FormField control={form.control} name="terms" render={({ field }) => (
              <FormItem>
                <div className={styles.checkRow}>
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="font-normal">I agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create SentinelStack workspace →
            </Button>
          </form>
        </Form>

        <div className={styles.divider}>already have an account?</div>
        <p className={styles.switchText}><Link href="/login">Sign in to your workspace →</Link></p>
      </div>
    </div>
  );
}
