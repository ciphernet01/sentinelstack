'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  ShieldAlert,
  File,
  Settings,
  LogOut,
  FileText,
  LineChart,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SentinelStackLogo } from '@/lib/icons';
import { Badge } from '../ui/badge';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/dashboard/assessments', icon: ShieldAlert, label: 'Assessments' },
  { href: '/dashboard/reports', icon: File, label: 'Reports & Exports' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canReset =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEV_RESET === 'true';

  const resetAssessments = async () => {
    try {
      const res = await api.post('/assessments/reset');
      const deleted = res.data?.deletedAssessments ?? 0;
      toast({
        title: 'Reset complete',
        description: `Deleted ${deleted} assessment(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      router.push('/dashboard/onboarding');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description: e?.response?.data?.message || e?.message || 'Could not reset assessments.',
      });
    }
  };

  // Correctly identify the active link. The dashboard link should only be active
  // when the path is exactly '/dashboard'. Other links are active if the path
  // starts with their href.
  const getIsActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="hidden md:flex flex-col w-64 bg-card border-r border-border shrink-0">
      <div className="flex flex-col h-full p-4 space-y-6">
        {/* Logo */}
        <div className="flex items-center px-2">
          <SentinelStackLogo width={200} />
        </div>

        {/* User Info */}
        {user && (
          <div className="px-2 space-y-2">
            <p className="text-sm font-semibold truncate" title={user.name || undefined}>
              {user.name}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={user.email}>
              {user.email}
            </p>
            <div className="flex flex-col items-start gap-2">
              {user.role && (
                <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 border-none capitalize text-xs">
                  {user.role.toLowerCase()}
                </Badge>
              )}
              {user.organization && (
                <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-none text-xs">
                  {user.organization}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <p className="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Quick Actions
          </p>
          <Button
            asChild
            className="w-full h-auto justify-center bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold whitespace-normal hover:opacity-90 transition-opacity py-2"
          >
            <Link href="/dashboard/reports">
              <span className="flex w-full items-center justify-center gap-1">
                <FileText className="h-4 w-4" />
                <span className="text-center leading-tight whitespace-normal">Generate Executive Report</span>
              </span>
            </Link>
          </Button>
          <Button
            asChild
            className="w-full h-auto justify-center bg-gradient-to-r from-emerald-500 to-green-500 text-sm font-semibold whitespace-normal hover:opacity-90 transition-opacity py-2"
          >
            <Link href="/dashboard/analytics">
              <span className="flex w-full items-center justify-center gap-1">
                <LineChart className="h-4 w-4" />
                <span className="text-center leading-tight whitespace-normal">View Risk Analytics</span>
              </span>
            </Link>
          </Button>

          {canReset && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-auto justify-center text-sm font-semibold whitespace-normal py-2"
              onClick={resetAssessments}
            >
              Reset Assessments (Dev)
            </Button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 space-y-2">
          <p className="px-2 pt-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Navigation
          </p>
          <nav className="grid items-start text-sm font-medium">
            {navItems.map(item => {
              const isActive = getIsActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary-foreground hover:bg-secondary',
                    isActive && 'bg-secondary text-primary-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout */}
        <div className="mt-auto">
          <Button
            onClick={() => logout()}
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:bg-secondary hover:text-primary-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
