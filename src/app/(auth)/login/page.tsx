'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, Activity, FileCheck2 } from 'lucide-react';
import React, { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, Mail } from '@/lib/icons';
import api from '@/lib/api';
import { usePageTitle } from '@/hooks/use-page-title';
import styles from '@/components/auth/AuthPage.module.css';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type FormData = z.infer<typeof formSchema>;

function LoginPageContent() {
  usePageTitle('Login');
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const reason = searchParams.get('reason');
  const emailFromQuery = searchParams.get('email') || '';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: emailFromQuery, password: '' },
  });
  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    if (emailFromQuery) return;
    try {
      const remembered = localStorage.getItem('lastAuthEmail');
      if (remembered) form.setValue('email', remembered, { shouldDirty: false });
    } catch {}
  }, [emailFromQuery, form]);

  React.useEffect(() => {
    if (reason === 'email-not-verified') {
      toast({ title: 'Email verification required', description: 'Please check your email for the verification link to activate your account.' });
    }
  }, [reason, toast]);

  const handleResendVerification = async () => {
    const email = form.getValues('email');
    if (!email) {
      toast({ variant: 'destructive', title: 'Email required', description: 'Enter your email address, then click resend.' });
      return;
    }
    setResending(true);
    try {
      const response = await api.post('/auth/resend-verification', { email });
      toast({ title: 'Verification email sent', description: response.data?.message || 'Check your inbox for a new verification link.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Resend failed', description: error.response?.data?.message || 'Please try again later.' });
    } finally {
      setResending(false);
    }
  };

  const handleLogin = async (data: FormData) => {
    try {
      try { localStorage.setItem('lastAuthEmail', data.email); } catch {}
      await login(data.email, data.password);
      toast({ title: 'Login Successful', description: 'Welcome back! Redirecting you to the dashboard.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message || 'An unexpected error occurred. Please try again.' });
    }
  };

  return (
    <div className={styles.gridTwo}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}><span className={styles.eyebrowDot} /> Secure access</div>
        <h1 className={styles.title}>Welcome<br />back.</h1>
        <p className={styles.subtitle}>Sign in to continue to SentinelStack and turn security findings into clear, business-ready risk intelligence.</p>
        <div className={styles.points}>
          <div className={styles.point}><span className={styles.pointIcon}><ShieldCheck size={15} /></span><span>Continuous security assessment across your application stack.</span></div>
          <div className={styles.point}><span className={styles.pointIcon}><Activity size={15} /></span><span>Unified risk visibility for technical and business stakeholders.</span></div>
          <div className={styles.point}><span className={styles.pointIcon}><FileCheck2 size={15} /></span><span>Audit-ready reporting mapped to leading security frameworks.</span></div>
        </div>
        <div className={styles.systemCard}>
          <div className={styles.systemTop}><span>SentinelStack platform</span><span className={styles.status}>Systems ready</span></div>
          <div className={styles.systemLines}><div className={styles.systemLine} /><div className={styles.systemLine} /><div className={styles.systemLine} /></div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Sign in</h2>
          <p className={styles.cardDescription}>Use your SentinelStack workspace credentials.</p>
        </div>

        {reason === 'email-not-verified' && (
          <div className={styles.notice}>
            <strong>Please verify your email</strong>
            We sent you a verification link. Check your inbox (and spam), verify your email, then come back and log in.
            <div className={styles.noticeActions}>
              <button type="button" className={styles.noticeButton} onClick={handleResendVerification} disabled={resending}>
                {resending && <Loader2 size={13} className="mr-1.5 inline animate-spin" />}
                Resend verification
              </button>
              <Link href={`/verify-email/resend${emailFromQuery ? `?email=${encodeURIComponent(emailFromQuery)}` : ''}`} className={styles.noticeButton}>Open resend page</Link>
              <Link href="/verify-email" className={styles.noticeButton}>I have a link</Link>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLogin)} className={styles.form}>
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem className={styles.field}>
                <FormLabel className={styles.fieldLabel}>Email</FormLabel>
                <FormControl>
                  <div className={styles.inputWrap}>
                    <Mail className={styles.inputIcon} size={18} />
                    <Input placeholder="security@company.com" {...field} className={`${styles.input} ${styles.inputWithIcon}`} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem className={styles.field}>
                <div className={styles.rowBetween}>
                  <FormLabel className={styles.fieldLabel}>Password</FormLabel>
                  <Link href="/forgot-password" className={styles.forgot}>Forgot password?</Link>
                </div>
                <FormControl>
                  <div className={styles.inputWrap}>
                    <Lock className={styles.inputIcon} size={18} />
                    <Input type={showPassword ? 'text' : 'password'} {...field} className={`${styles.input} ${styles.inputWithIcon} ${styles.passwordInput}`} />
                    <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className={styles.eye}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in to SentinelStack →
            </Button>
          </form>
        </Form>

        <div className={styles.divider}>or</div>
        <p className={styles.switchText}>Don&apos;t have an account? <Link href="/signup">Create your workspace →</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Sign in</h2><p className={styles.cardDescription}>Loading secure access…</p></div></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
