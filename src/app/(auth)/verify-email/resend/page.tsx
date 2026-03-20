'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';

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

function ResendVerifyEmailContent() {
  usePageTitle('Resend Verification');

  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const emailFromQuery = searchParams.get('email') || '';

  const form = useForm<ResendFormData>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: emailFromQuery },
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    if (emailFromQuery) {
      form.setValue('email', emailFromQuery, { shouldDirty: false });
      try {
        localStorage.setItem('lastAuthEmail', emailFromQuery);
      } catch {
        // ignore
      }
      return;
    }

    try {
      const remembered = localStorage.getItem('lastAuthEmail');
      if (remembered) {
        form.setValue('email', remembered, { shouldDirty: false });
      }
    } catch {
      // ignore
    }
  }, [emailFromQuery, form]);

  const onSubmit = async (data: ResendFormData) => {
    try {
      try {
        localStorage.setItem('lastAuthEmail', data.email);
      } catch {
        // ignore
      }
      const response = await api.post('/auth/resend-verification', { email: data.email });
      setSentTo(data.email);
      toast({
        title: 'Verification email sent',
        description: response.data?.message || 'Check your inbox for the new verification link.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not resend email',
        description: error.response?.data?.message || 'Please try again later.',
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-none bg-transparent shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Resend verification email</CardTitle>
          <CardDescription>
            Enter the email you used to sign up. We’ll send a fresh verification link.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {sentTo && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Sent
              </div>
              <div className="mt-1 text-green-800">
                We sent a new verification email to <span className="font-medium">{sentTo}</span>.
                Please check your inbox and spam.
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
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

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send verification email
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            Tip: open the latest email and click the link — it will verify automatically.
          </div>

          <div className="grid gap-2">
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">Back to Login</Button>
            </Link>
            <Link href="/signup" className="block">
              <Button variant="ghost" className="w-full">Create a new account</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResendVerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ResendVerifyEmailContent />
    </Suspense>
  );
}
