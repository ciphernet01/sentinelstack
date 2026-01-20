'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, Mail } from '@/lib/icons';
import api from '@/lib/api';
import { usePageTitle } from '@/hooks/use-page-title';

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
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  const reason = searchParams.get('reason');
  const emailFromQuery = searchParams.get('email') || '';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: emailFromQuery,
      password: '',
    },
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    if (emailFromQuery) return;
    try {
      const remembered = localStorage.getItem('lastAuthEmail');
      if (remembered) {
        form.setValue('email', remembered, { shouldDirty: false });
      }
    } catch {
      // ignore
    }
  }, [emailFromQuery, form]);

  React.useEffect(() => {
    if (reason === 'email-not-verified') {
      toast({
        title: 'Email verification required',
        description: 'Please check your email for the verification link to activate your account.',
      });
    }
  }, [reason, toast]);

  const handleResendVerification = async () => {
    const email = form.getValues('email');
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Enter your email address, then click resend.',
      });
      return;
    }

    setResending(true);
    try {
      const response = await api.post('/auth/resend-verification', { email });
      toast({
        title: 'Verification email sent',
        description: response.data?.message || 'Check your inbox for a new verification link.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Resend failed',
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleLogin = async (data: FormData) => {
    try {
      try {
        localStorage.setItem('lastAuthEmail', data.email);
      } catch {
        // ignore
      }
      await login(data.email, data.password);
      toast({
        title: 'Login Successful',
        description: "Welcome back! Redirecting you to the dashboard.",
      });
      // The redirection is now handled by the AuthContext, so we remove it from here.
      // router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
      });
    }
  };

  return (
    <Card className="mx-auto w-full border-none bg-transparent shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-headline">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to access the SentinelStack platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reason === 'email-not-verified' && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-medium">Please verify your email</div>
            <div className="mt-1">
              We sent you a verification link. Check your inbox (and spam). Once verified, come back and log in.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleResendVerification} disabled={resending}>
                {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend verification email
              </Button>
              <Link
                href={`/verify-email/resend${emailFromQuery ? `?email=${encodeURIComponent(emailFromQuery)}` : ''}`}
                className="inline-flex"
              >
                <Button type="button" variant="outline">
                  Open resend page
                </Button>
              </Link>
              <Link href="/verify-email" className="inline-flex">
                <Button type="button" variant="outline">
                  I have a link
                </Button>
              </Link>
            </div>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLogin)} className="grid gap-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input placeholder="security@company.com" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                    <div className="flex items-center">
                        <FormLabel>Password</FormLabel>
                        <Link href="/forgot-password" className="ml-auto inline-block text-sm text-primary underline">
                            Forgot your password?
                        </Link>
                    </div>
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
                    <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
        <div className="mt-6 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary underline">
            Sign up here →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="mx-auto w-full border-none bg-transparent shadow-none">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-headline">Welcome Back</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
