'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { User } from '@prisma/client';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, AuthError } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps } from 'firebase/app';

function getClientAuth() {
  if (typeof window === 'undefined') return null;
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  return getAuth();
}


interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  signup: (email: string, password: string) => Promise<any>;
  logout: (redirectTo?: string) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) {
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const idToken = await firebaseUser.getIdToken();
            localStorage.setItem('authToken', idToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;
            
            try {
                const initPayload: Record<string, any> = {};
                try {
                  const pendingEmail = localStorage.getItem('pendingSignupEmail');
                  const pendingName = localStorage.getItem('pendingSignupName');
                  const pendingOrg = localStorage.getItem('pendingSignupOrganizationName');
                  const pendingPersona = localStorage.getItem('pendingSignupPersona');

                  const currentEmail = (firebaseUser.email || '').toLowerCase();
                  const pendingMatchesUser =
                    !pendingEmail || (currentEmail && pendingEmail.toLowerCase() === currentEmail);

                  if (pendingMatchesUser) {
                    if (pendingName) initPayload.name = pendingName;
                    if (pendingOrg) initPayload.organizationName = pendingOrg;
                    if (pendingPersona) initPayload.persona = pendingPersona;
                  } else {
                    // Avoid leaking signup data to a different account.
                    localStorage.removeItem('pendingSignupEmail');
                    localStorage.removeItem('pendingSignupName');
                    localStorage.removeItem('pendingSignupOrganizationName');
                    localStorage.removeItem('pendingSignupPersona');
                  }
                } catch {
                  // ignore
                }

                const response = await api.post('/auth/init', initPayload);
                if (response.data.user) {
                    setUser(response.data.user);
                     // If user is on an auth page, redirect them to the dashboard.
                    if (pathname === '/login' || pathname === '/signup') {
                        router.push('/dashboard');
                    }
                } else {
                    throw new Error(response.data.message || 'Failed to initialize user.');
                }

                try {
                  localStorage.removeItem('pendingSignupEmail');
                  localStorage.removeItem('pendingSignupName');
                  localStorage.removeItem('pendingSignupOrganizationName');
                  localStorage.removeItem('pendingSignupPersona');
                } catch {
                  // ignore
                }
            } catch (error: any) {
                console.error("Backend user initialization failed", error);
                
                // Check if email is not verified
                if (error.response?.data?.errorCode === 'EMAIL_NOT_VERIFIED') {
                    // Sign out and show verification message
                    await signOut(auth);
                    localStorage.removeItem('authToken');
                    delete api.defaults.headers.common['Authorization'];

                // Persist email for prefilling resend/login forms.
                if (firebaseUser.email) {
                  localStorage.setItem('lastAuthEmail', firebaseUser.email);
                }

                // Redirect to login with a friendly message prompt.
                // Preserve email (if available) so UI can offer "Resend verification".
                const email = encodeURIComponent(firebaseUser.email || '');
                const target = `/login?reason=email-not-verified${email ? `&email=${email}` : ''}`;
                if (!pathname?.startsWith('/verify-email')) {
                  router.push(target);
                }
                } else {
                    await signOut(auth); // Log out if backend init fails
                }

                // If init fails for reasons other than email verification, clear pending signup details
                // so they don't get applied to a later session.
                if (error.response?.data?.errorCode !== 'EMAIL_NOT_VERIFIED') {
                  try {
                    localStorage.removeItem('pendingSignupEmail');
                    localStorage.removeItem('pendingSignupName');
                    localStorage.removeItem('pendingSignupOrganizationName');
                    localStorage.removeItem('pendingSignupPersona');
                  } catch {
                    // ignore
                  }
                }
            }
        } else {
            // User is signed out
            setUser(null);
            localStorage.removeItem('authToken');
            delete api.defaults.headers.common['Authorization'];
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const login = async (email: string, password: string) => {
    // This will use Firebase to sign in. The onAuthStateChanged listener handles the rest.
    const auth = getClientAuth();
    if (!auth) throw new Error('Auth is not available on the server.');
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string) => {
    // This will use Firebase to create a user. The onAuthStateChanged listener handles the rest.
    const auth = getClientAuth();
    if (!auth) throw new Error('Auth is not available on the server.');
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = (redirectTo?: string) => {
    const auth = getClientAuth();
    if (auth) signOut(auth);
    const target = typeof redirectTo === 'string' && redirectTo.length > 0 ? redirectTo : '/login';
    router.push(target);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
