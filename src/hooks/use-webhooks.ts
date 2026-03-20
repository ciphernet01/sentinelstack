'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type WebhookEvent = 'SCAN_COMPLETED' | 'SCAN_FAILED' | 'CRITICAL_FINDING' | 'SCHEDULED_SCAN_RUN';

export interface WebhookDelivery {
  id: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  statusCode: number | null;
  responseBody: string | null;
  responseTime: number | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  enabled: boolean;
  events: WebhookEvent[];
  lastTriggeredAt: string | null;
  lastStatus: number | null;
  failureCount: number;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    deliveries: number;
  };
  deliveries?: WebhookDelivery[];
}

export function useWebhooks() {
  return useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const response = await api.get('/webhooks');
      return response.data.webhooks;
    },
  });
}

export function useWebhook(id: string) {
  return useQuery<Webhook>({
    queryKey: ['webhook', id],
    queryFn: async () => {
      const response = await api.get(`/webhooks/${id}`);
      return response.data.webhook;
    },
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      url: string;
      events: WebhookEvent[];
    }) => {
      const response = await api.post('/webhooks', data);
      return response.data.webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      url?: string;
      events?: WebhookEvent[];
      enabled?: boolean;
    }) => {
      const response = await api.patch(`/webhooks/${id}`, data);
      return response.data.webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useToggleWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await api.post(`/webhooks/${id}/toggle`, { enabled });
      return response.data.webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useTestWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/webhooks/${id}/test`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useRegenerateWebhookSecret() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/webhooks/${id}/regenerate-secret`);
      return response.data.webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}
