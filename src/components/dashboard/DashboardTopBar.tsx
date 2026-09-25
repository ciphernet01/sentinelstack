'use client';

import { ChevronRight, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SentinelStackLogo } from '@/lib/icons';

const labels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/risk-intelligence': 'Risk Intelligence',
  '/dashboard/assessments': 'Assessments',
  '/dashboard/analytics': 'Risk Analytics',
  '/dashboard/schedules': 'Schedules',
  '/dashboard/webhooks': 'Webhooks',
  '/dashboard/api-keys': 'API Keys',
  '/dashboard/reports': 'Reports & Exports',
  '/dashboard/team': 'Team',
  '/dashboard/settings': 'Settings',
};

export function DashboardTopBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const current = labels[pathname] ?? Object.entries(labels).find(([key]) => pathname.startsWith(`${key}/`))?.[1] ?? 'Dashboard';

  return (
    <header className="sticky top-0 z-50 flex h-[60px] shrink-0 items-center border-b border-cyan-200/[0.06] bg-[#02080b]/[0.98] px-3 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/dashboard" aria-label="SentinelStack dashboard" className="shrink-0">
          <SentinelStackLogo width={156} className="transition-opacity duration-200 hover:opacity-90" />
        </Link>
        <div className="mx-1 h-6 w-px bg-white/[0.055]" />
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.018] text-slate-500 transition-[background-color,border-color,color,transform] duration-200 hover:border-cyan-200/15 hover:bg-cyan-300/[0.04] hover:text-cyan-100 active:scale-[0.97]"
          aria-label={sidebarOpen ? 'Collapse navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <ChevronRight className="hidden h-3 w-3 text-slate-700 sm:block" />
        <span className="truncate text-[11px] font-medium text-slate-300">{current}</span>
      </div>
    </header>
  );
}
