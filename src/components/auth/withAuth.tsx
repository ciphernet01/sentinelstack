'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function withAuth<P extends object>(WrappedComponent: React.ComponentType<P>) {
  const AuthComponent = (props: P) => {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isAuthenticated) router.replace('/login');
    }, [isAuthenticated, loading, router]);

    if (loading || !isAuthenticated) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-[#02080b] text-slate-400">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em]">Authenticating SentinelStack</span>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  AuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return AuthComponent;
}
