'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { usePageTitle } from '@/hooks/use-page-title';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

type FormData = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  usePageTitle('Forgot Password');

  const router = useRouter();
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: FormData) => {
    try {
      const response = await api.post('/auth/request-password-reset', data);

      setEmailSent(true);
      toast({
        title: 'Reset Link Sent',
        description: response.data.message || 'Check your email for the password reset link.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Request Failed',
        description: error.response?.data?.message || 'Failed to send reset link. Please try again.',
      });
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="mx-auto w-full max-w-md border-none bg-transparent shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-headline">Check Your Email</CardTitle>
            <CardDescription className="text-base">
              We&apos;ve sent a password reset link to your email address. Please check your inbox and follow the instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Form
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setEmailSent(false)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  try again
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-none bg-transparent shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Forgot Password?</CardTitle>
          <CardDescription>
            No worries! Enter your email and we&apos;ll send you reset instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="your.email@company.com"
                          className="pl-9"
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="inline-flex items-center text-primary underline-offset-4 hover:underline">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
