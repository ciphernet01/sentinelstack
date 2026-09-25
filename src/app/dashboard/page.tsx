'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { Assessment, Finding } from '@prisma/client';

import api from '@/lib/api';
import withAuth from '@/components/auth/withAuth';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/use-page-title';
import { useCyberRisk } from '@/hooks/use-cyber-risk';
import { DashboardCommandCenter } from '@/components/dashboard/redesigned/DashboardCommandCenter';

interface DashboardStats {
  overallRiskScore: number;
  totalAssessments: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  deltas: {
    overallRiskScore: number;
    criticalCount: number;
    highCount: number;
    totalAssessments: number;
  };
}

export type AssessmentWithFindings = Assessment & { findings: Finding[] };

interface DashboardData {
  stats: DashboardStats;
  recentAssessments: AssessmentWithFindings[];
  findingsOverTime: { name: string; total: number }[];
}

type ScanQueueStats = {
  now: string;
  counts: Record<string, number>;
  runnableQueued: number;
  oldestQueuedAgeSeconds: number;
};

type AnalyticsData = {
  severityDistribution?: Record<string, number>;
  totalFindings?: number;
};

function DashboardPage() {
  usePageTitle('Dashboard');

  const { user } = useAuth();
  const { toast } = useToast();
  const riskBudgetInr = 10_000_000;

  const {
    data,
    isLoading,
    error,
  } = useQuery<DashboardData, Error>({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary');
      return response.data;
    },
    retry: false,
  });

  const {
    data: cyberRisk,
    isLoading: isCyberRiskLoading,
  } = useCyberRisk(riskBudgetInr);

  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
  } = useQuery<AnalyticsData, Error>({
    queryKey: ['dashboardCommandCenterAnalytics', 30],
    queryFn: async () => {
      const response = await api.get('/dashboard/analytics?days=30');
      return response.data;
    },
    retry: false,
  });

  const isPlatformAdmin = user?.role === 'ADMIN';

  const {
    data: scanQueueStats,
    isLoading: isScanQueueLoading,
  } = useQuery<ScanQueueStats, Error>({
    queryKey: ['scanQueueStats'],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const response = await api.get('/admin/scan-queue');
      return response.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load dashboard data',
        description: 'There was an error fetching data from the server. Please try again later.',
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#02080b]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em]">Loading SentinelStack intelligence</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#02080b] px-6">
        <div className="max-w-md rounded-xl border border-rose-300/10 bg-[#071317] p-7 text-center shadow-2xl">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-rose-300/70">Dashboard unavailable</div>
          <h1 className="mt-2 text-lg font-semibold text-slate-100">Unable to load SentinelStack data</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            The existing dashboard endpoint could not be reached. No replacement or mock data is being rendered.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardCommandCenter
      userName={user?.name}
      stats={data.stats}
      recentAssessments={data.recentAssessments}
      findingsOverTime={data.findingsOverTime}
      cyberRisk={cyberRisk}
      analytics={analytics}
      scanQueueStats={scanQueueStats}
      isScanQueueLoading={isScanQueueLoading}
      isCyberRiskLoading={isCyberRiskLoading || isAnalyticsLoading}
    />
  );
}

export default withAuth(DashboardPage);
