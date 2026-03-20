'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type ScheduleType = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface ScheduledScan {
  id: string;
  name: string;
  targetUrl: string;
  toolPreset: string;
  schedule: string;
  scheduleType: ScheduleType;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

export function useScheduledScans() {
  return useQuery<ScheduledScan[]>({
    queryKey: ['scheduledScans'],
    queryFn: async () => {
      const response = await api.get('/scheduled-scans');
      return response.data.scheduledScans;
    },
  });
}

export function useScheduledScan(id: string) {
  return useQuery<ScheduledScan>({
    queryKey: ['scheduledScan', id],
    queryFn: async () => {
      const response = await api.get(`/scheduled-scans/${id}`);
      return response.data.scheduledScan;
    },
    enabled: !!id,
  });
}

export function useCreateScheduledScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      targetUrl: string;
      toolPreset: string;
      scheduleType: ScheduleType;
      timezone?: string;
    }) => {
      const response = await api.post('/scheduled-scans', data);
      return response.data.scheduledScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScans'] });
    },
  });
}

export function useUpdateScheduledScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      targetUrl?: string;
      toolPreset?: string;
      scheduleType?: ScheduleType;
      timezone?: string;
      enabled?: boolean;
    }) => {
      const response = await api.patch(`/scheduled-scans/${id}`, data);
      return response.data.scheduledScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScans'] });
    },
  });
}

export function useDeleteScheduledScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/scheduled-scans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScans'] });
    },
  });
}

export function useToggleScheduledScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await api.post(`/scheduled-scans/${id}/toggle`, { enabled });
      return response.data.scheduledScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScans'] });
    },
  });
}
