'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import React, { Suspense } from 'react';
import { Loader2, Users, CheckCircle2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, user, logout } = useAuth();

  const token = (searchParams.get('token') || '').trim();
  const [status, setStatus] = React.useState<'idle' | 'accepting' | 'accepted' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem('pendingInviteToken', token);
    } catch {
      // ignore
    }
  }, [token]);

  React.useEffect(() => {
    const accept = async () => {
      if (!token) return;
      if (!isAuthenticated) return;

      setStatus('accepting');
      setErrorMessage(null);

      try {
        await api.post('/org/invitations/accept', { token });
        try {
          localStorage.removeItem('pendingInviteToken');
        } catch {
          // ignore
        }

        setStatus('accepted');
        toast({
          title: 'Invitation accepted',
          description: 'Welcome aboard. Taking you to your dashboard…',
        });

        // Force a reload so the AuthContext re-initializes the user/org context.
        window.location.assign('/dashboard');
      } catch (error: any) {
        const msg = error?.response?.data?.message || 'Could not accept invitation. Please try again.';
        setStatus('error');
        setErrorMessage(msg);

        if (error?.response?.data?.errorCode === 'INVITE_EMAIL_MISMATCH') {
          setInviteEmail(String(error?.response?.data?.invitationEmail || '') || null);
          setCurrentEmail(String(error?.response?.data?.currentEmail || '') || null);
        }

        if (error?.response?.data?.errorCode === 'EMAIL_NOT_VERIFIED') {
          router.push('/login?reason=email-not-verified');
          return;
        }

        if (error?.response?.status === 401) {
          // Session missing/expired
          router.push('/login');
          return;
        }

        toast({
          variant: 'destructive',
          title: 'Invitation failed',
          description: msg,
        });
      }
    };

    void accept();
  }, [token, isAuthenticated, router, toast]);

  const showMissingToken = !token;
  const showMismatch = status === 'error' && (inviteEmail || currentEmail || user?.email);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-none bg-transparent shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Team invitation</CardTitle>
          <CardDescription>
            {showMissingToken
              ? 'This invite link is missing a token.'
              : isAuthenticated
              ? 'Accepting your invitation…'
              : 'Sign in with the invited email to join the team.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {showMissingToken && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Invalid link
              </div>
              <div className="mt-1 text-yellow-800">Ask your admin to resend the invitation.</div>
            </div>
          )}

          {status === 'accepted' && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Accepted
              </div>
              <div className="mt-1 text-green-800">Redirecting you to your dashboard…</div>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Could not accept
              </div>
              <div className="mt-1 text-red-800">{errorMessage}</div>

              {showMismatch && (
                <div className="mt-3 space-y-2 text-xs text-red-800">
                  <div>
                    <span className="font-medium">Signed in as:</span> {currentEmail || user?.email || 'Unknown'}
                  </div>
                  {inviteEmail && (
                    <div>
                      <span className="font-medium">Invite sent to:</span> {inviteEmail}
                    </div>
                  )}
                  {inviteEmail && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-red-200 bg-white text-red-900 hover:bg-red-50"
                      onClick={() => {
                        // Sign out, then take the user to login with the invited email prefilled.
                        logout(`/login?email=${encodeURIComponent(inviteEmail)}&reason=invite-email-mismatch`);
                      }}
                    >
                      Switch account to accept
                    </Button>
                  )}
                  <div className="text-red-700">
                    Tip: open this link in an Incognito window if you want to keep both accounts signed in.
                  </div>
                </div>
              )}
            </div>
          )}

          {isAuthenticated ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === 'accepting' ? 'Accepting invitation…' : 'Working…'}
            </div>
          ) : (
            <div className="grid gap-2">
              <Link href="/login" className="block">
                <Button className="w-full">Sign in to accept</Button>
              </Link>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">Create an account</Button>
              </Link>
              <div className="text-center text-xs text-muted-foreground">
                Tip: use the same email address the invite was sent to.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
