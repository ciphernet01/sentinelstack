'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { usePageTitle } from '@/hooks/use-page-title';

const resendSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

type ResendFormData = z.infer<typeof resendSchema>;

function VerifyEmailContent() {
  usePageTitle('Verify Email');

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'expired'>('verifying');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  const resendForm = useForm<ResendFormData>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    try {
      const remembered = localStorage.getItem('lastAuthEmail');
      if (remembered) {
        resendForm.setValue('email', remembered, { shouldDirty: false });
      }
    } catch {
      // ignore
    }
  }, [resendForm]);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is invalid or incomplete.');
      return;
    }

    const run = async () => {
      try {
        const response = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');

        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Verification failed.';
        setMessage(errorMessage);

        if (errorMessage.includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
      }
    };

    run();
  }, [token, router]);

  const handleResendVerification = async () => {
    const email = resendForm.getValues('email');
    setResending(true);
    try {
      try {
        localStorage.setItem('lastAuthEmail', email);
      } catch {
        // ignore
      }
      const response = await api.post('/auth/resend-verification', { email });
      toast({
        title: 'Verification Email Sent',
        description: response.data.message || 'Check your inbox for a new verification link.',
      });
      resendForm.reset({ email });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Resend',
        description: error.response?.data?.message || 'Please try again later.',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-none bg-transparent shadow-none">
        <CardHeader className="text-center">
          {status === 'verifying' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl font-headline">Verifying Email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-headline">Email Verified!</CardTitle>
              <CardDescription>{message}</CardDescription>
              <CardDescription className="mt-2 text-sm">
                Redirecting to login page...
              </CardDescription>
            </>
          )}

          {(status === 'error' || status === 'expired') && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-headline">Verification Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>

        {(status === 'error' || status === 'expired') && (
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-4">
                <div className="text-sm font-medium">Resend verification email</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Enter the email you used to sign up and we’ll send a fresh link.
                </div>

                <Form {...resendForm}>
                  <form
                    className="mt-4 grid gap-3"
                    onSubmit={resendForm.handleSubmit(handleResendVerification)}
                  >
                    <FormField
                      control={resendForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                              <Input placeholder="you@company.com" {...field} className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={resending}>
                      {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Resend verification email
                    </Button>
                  </form>
                </Form>
              </div>

              <Link href="/login" className="block">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>

              <Link href="/verify-email/resend" className="block">
                <Button variant="ghost" className="w-full">
                  Resend from a dedicated page
                </Button>
              </Link>
            </div>
          </CardContent>
        )}

        {status === 'success' && (
          <CardContent>
            <Link href="/login" className="block">
              <Button className="w-full">Continue to Login</Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
