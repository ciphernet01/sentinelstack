'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface UsageData {
  usage: {
    scansUsed: number;
    scansLimit: number;
    scansRemaining: number | 'unlimited';
    resetAt: string;
  };
  limits: {
    scansPerMonth: number;
    teamMembers: number;
    historyDays: number;
    apiAccess: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    scheduledScans: boolean;
  };
}

export function useSubscriptionUsage() {
  return useQuery<UsageData>({
    queryKey: ['subscriptionUsage'],
    queryFn: async () => {
      const response = await api.get('/billing/usage');
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    retry: false,
  });
}

export function useCanScan() {
  return useQuery<{ allowed: boolean; reason?: string }>({
    queryKey: ['canScan'],
    queryFn: async () => {
      const response = await api.post('/billing/can-scan');
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: false,
  });
}
