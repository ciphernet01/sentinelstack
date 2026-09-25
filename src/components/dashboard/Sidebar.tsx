'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  ChevronRight,
  File,
  Key,
  Landmark,
  LayoutGrid,
  LineChart,
  LogOut,
  RotateCcw,
  Settings,
  ShieldAlert,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/dashboard/risk-intelligence', icon: Landmark, label: 'Risk Intelligence' },
  { href: '/dashboard/assessments', icon: ShieldAlert, label: 'Assessments' },
  { href: '/dashboard/analytics', icon: LineChart, label: 'Risk Analytics' },
  { href: '/dashboard/schedules', icon: Calendar, label: 'Schedules' },
  { href: '/dashboard/webhooks', icon: Webhook, label: 'Webhooks' },
  { href: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  { href: '/dashboard/reports', icon: File, label: 'Reports & Exports' },
  { href: '/dashboard/team', icon: Users, label: 'Team' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canReset =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEV_RESET === 'true';

  const resetAssessments = async () => {
    try {
      const res = await api.post('/assessments/reset');
      const deleted = res.data?.deletedAssessments ?? 0;
      toast({ title: 'Reset complete', description: `Deleted ${deleted} assessment(s).` });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      router.push('/dashboard/onboarding');
      onClose();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description: e?.response?.data?.message || e?.message || 'Could not reset assessments.',
      });
    }
  };

  const getIsActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'absolute inset-y-0 left-0 z-40 w-[252px] overflow-hidden border-r border-cyan-200/[0.06] bg-[#02080b] shadow-[18px_0_45px_rgba(0,0,0,.22)] transition-transform duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)]',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className={cn(
        'flex h-full w-[252px] flex-col bg-[#02080b] transition-opacity duration-150',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.045] px-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(33,212,253,.7)]" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-slate-200"
            aria-label="Collapse navigation"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = getIsActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[11px] font-medium transition-[background-color,color,transform] duration-150',
                  isActive
                    ? 'bg-cyan-300/[0.075] text-cyan-100'
                    : 'text-slate-500 hover:bg-cyan-300/[0.045] hover:text-slate-200',
                )}
              >
                <span className={cn(
                  'absolute left-0 h-5 w-px transition-all duration-200',
                  isActive ? 'bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,.85)]' : 'bg-transparent',
                )} />
                <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105', isActive && 'text-cyan-200')} />
                <span className="truncate">{item.label}</span>
                <ChevronRight className={cn('ml-auto h-3 w-3 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-50', isActive && 'opacity-40')} />
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-white/[0.045] px-3 py-3">
          {canReset ? (
            <button
              type="button"
              onClick={resetAssessments}
              className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[10px] text-slate-700 transition-[background-color,color] duration-150 hover:bg-rose-300/[0.045] hover:text-rose-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset assessments (dev)
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => logout()}
            className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[10px] text-slate-600 transition-[background-color,color] duration-150 hover:bg-rose-300/[0.045] hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
          <div className="flex items-center gap-2 px-3 pt-2 text-[8px] uppercase tracking-[0.16em] text-slate-700">
            <Activity className="h-3 w-3 text-emerald-300/60" />
            System active
          </div>
        </div>
      </div>
    </aside>
  );
}
