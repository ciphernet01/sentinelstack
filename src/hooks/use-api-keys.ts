'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  enabled: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  plainKey?: string; // Only available on creation
}

export interface CreateApiKeyData {
  name: string;
  scopes: string[];
  expiresAt?: string;
}

export interface UpdateApiKeyData {
  name?: string;
  scopes?: string[];
  enabled?: boolean;
  expiresAt?: string | null;
}

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const response = await api.get('/api-keys');
      return response.data.apiKeys;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateApiKeyData) => {
      const response = await api.post('/api-keys', data);
      return response.data.apiKey as ApiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateApiKeyData }) => {
      const response = await api.patch(`/api-keys/${id}`, data);
      return response.data.apiKey as ApiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/api-keys/${id}/revoke`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

export const API_SCOPES = [
  { value: 'READ_ASSESSMENTS', label: 'Read Assessments', description: 'View assessments and their results' },
  { value: 'WRITE_ASSESSMENTS', label: 'Write Assessments', description: 'Create and manage assessments' },
  { value: 'READ_REPORTS', label: 'Read Reports', description: 'View generated reports' },
  { value: 'READ_WEBHOOKS', label: 'Read Webhooks', description: 'View webhook configurations' },
  { value: 'WRITE_WEBHOOKS', label: 'Write Webhooks', description: 'Create and manage webhooks' },
  { value: 'ADMIN', label: 'Admin', description: 'Full administrative access' },
];
