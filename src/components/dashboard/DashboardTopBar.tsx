'use client';

import { ChevronRight, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SentinelStackLogo } from '@/lib/icons';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

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
    <header className="sticky top-0 z-50 flex h-[60px] shrink-0 items-center border-b border-cc-hairline/20 bg-cc-surface/95 px-3 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/dashboard" aria-label="SentinelStack dashboard" className="shrink-0">
          <SentinelStackLogo width={156} className="transition-opacity duration-200 hover:opacity-90" />
        </Link>
        <div className="mx-1 h-6 w-px bg-cc-hairline/25" />
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cc-hairline/20 bg-cc-elevated text-cc-dim transition-[background-color,border-color,color,transform] duration-200 hover:border-cc-cyan/40 hover:bg-cc-cyan/10 hover:text-cc-cyan active:scale-[0.97]"
          aria-label={sidebarOpen ? 'Collapse navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <ChevronRight className="hidden h-3 w-3 text-cc-faint sm:block" />
        <span className="truncate text-[11px] font-medium text-cc-muted">{current}</span>
      </div>

      {/* Pushed right by ml-auto so it anchors to the far edge regardless of how
          long the breadcrumb label grows. */}
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
        <ThemeToggle />
      </div>
    </header>
  );
}
