'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { User } from '@prisma/client';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signOut,
} from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps } from 'firebase/app';

function getClientAuth() {
  if (typeof window === 'undefined') return null;
  if (getApps().length === 0) initializeApp(firebaseConfig);
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

  const pathnameRef = useRef(pathname);
  const initializedUidRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    mountedRef.current = true;
    const auth = getClientAuth();

    if (!auth) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const initializeBackendUser = async (firebaseUser: { uid: string; email: string | null }) => {
      const uid = firebaseUser.uid;

      // Token refreshes should only refresh the Authorization header. The backend
      // user bootstrap is identity-level work and must not run on every refresh.
      if (initializedUidRef.current === uid) return;

      try {
        const initPayload: Record<string, string> = {};

        try {
          const pendingEmail = localStorage.getItem('pendingSignupEmail');
          const pendingName = localStorage.getItem('pendingSignupName');
          const pendingOrg = localStorage.getItem('pendingSignupOrganizationName');
          const pendingPersona = localStorage.getItem('pendingSignupPersona');
          const currentEmail = (firebaseUser.email || '').toLowerCase();
          const pendingMatchesUser = !pendingEmail || (currentEmail && pendingEmail.toLowerCase() === currentEmail);

          if (pendingMatchesUser) {
            if (pendingName) initPayload.name = pendingName;
            if (pendingOrg) initPayload.organizationName = pendingOrg;
            if (pendingPersona) initPayload.persona = pendingPersona;
          } else {
            localStorage.removeItem('pendingSignupEmail');
            localStorage.removeItem('pendingSignupName');
            localStorage.removeItem('pendingSignupOrganizationName');
            localStorage.removeItem('pendingSignupPersona');
          }
        } catch {
          // localStorage is optional; authentication itself should continue.
        }

        const response = await api.post('/auth/init', initPayload);
        if (!response.data?.user) throw new Error(response.data?.message || 'Failed to initialize user.');

        initializedUidRef.current = uid;
        if (!mountedRef.current) return;

        setUser(response.data.user);

        try {
          localStorage.removeItem('pendingSignupEmail');
          localStorage.removeItem('pendingSignupName');
          localStorage.removeItem('pendingSignupOrganizationName');
          localStorage.removeItem('pendingSignupPersona');
        } catch {
          // ignore
        }

        const currentPath = pathnameRef.current;
        if (currentPath === '/login' || currentPath === '/signup') {
          router.replace('/dashboard');
        }
      } catch (error: any) {
        initializedUidRef.current = null;
        console.error('Backend user initialization failed', error);

        if (error?.response?.data?.errorCode === 'EMAIL_NOT_VERIFIED') {
          try {
            if (firebaseUser.email) localStorage.setItem('lastAuthEmail', firebaseUser.email);
          } catch {
            // ignore
          }

          await signOut(auth);
          if (!mountedRef.current) return;

          const email = encodeURIComponent(firebaseUser.email || '');
          const target = `/login?reason=email-not-verified${email ? `&email=${email}` : ''}`;
          if (!pathnameRef.current?.startsWith('/verify-email')) router.replace(target);
          return;
        }

        // Do not leave the UI in a permanently authenticated-looking state when
        // Firebase succeeded but the SentinelStack session could not initialize.
        await signOut(auth);
        if (mountedRef.current && !pathnameRef.current?.startsWith('/login')) {
          router.replace('/login?reason=backend-unavailable');
        }
      }
    };

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        initializedUidRef.current = null;
        if (mountedRef.current) {
          setUser(null);
          setLoading(false);
        }
        try {
          localStorage.removeItem('authToken');
          delete api.defaults.headers.common.Authorization;
        } catch {
          // ignore
        }
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        localStorage.setItem('authToken', idToken);
        api.defaults.headers.common.Authorization = `Bearer ${idToken}`;
      } catch (error) {
        console.error('Unable to refresh Firebase ID token', error);
        await signOut(auth);
        return;
      }

      if (mountedRef.current) setLoading(true);
      await initializeBackendUser(firebaseUser);
      if (mountedRef.current) setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [router]);

  const login = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Auth is not available on the server.');
    initializedUidRef.current = null;
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Auth is not available on the server.');
    initializedUidRef.current = null;
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = (redirectTo?: string) => {
    initializedUidRef.current = null;
    const auth = getClientAuth();
    if (auth) void signOut(auth);
    const target = typeof redirectTo === 'string' && redirectTo.length > 0 ? redirectTo : '/login';
    router.replace(target);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
