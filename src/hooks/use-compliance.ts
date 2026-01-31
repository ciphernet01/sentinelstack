'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ComplianceType } from '@prisma/client';

export interface ComplianceBadge {
  id: string;
  organizationId: string;
  type: ComplianceType;
  name: string;
  description: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verificationUrl: string | null;
  certificateUrl: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  badgeImageUrl: string | null;
  displayOnPublicPage: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceBadgeInput {
  type: ComplianceType;
  name?: string;
  description?: string | null;
  isVerified?: boolean;
  verifiedAt?: string | null;
  verificationUrl?: string | null;
  certificateUrl?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  badgeImageUrl?: string | null;
  displayOnPublicPage?: boolean;
  displayOrder?: number;
}

export interface ComplianceStats {
  total: number;
  verified: number;
  expired: number;
  expiringSoon: number;
}

export interface BadgeTypeMeta {
  name: string;
  description: string;
  icon: string;
}

export function useComplianceBadges() {
  return useQuery({
    queryKey: ['compliance-badges'],
    queryFn: async () => {
      const res = await api.get('/compliance');
      return res.data.badges as ComplianceBadge[];
    },
  });
}

export function useComplianceStats() {
  return useQuery({
    queryKey: ['compliance-stats'],
    queryFn: async () => {
      const res = await api.get('/compliance/stats');
      return res.data.stats as ComplianceStats;
    },
  });
}

export function useBadgeTypes() {
  return useQuery({
    queryKey: ['badge-types'],
    queryFn: async () => {
      const res = await api.get('/compliance/types');
      return res.data.types as Record<ComplianceType, BadgeTypeMeta>;
    },
    staleTime: Infinity, // Badge types don't change
  });
}

export function useCreateBadge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ComplianceBadgeInput) => {
      const res = await api.post('/compliance', data);
      return res.data.badge as ComplianceBadge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-badges'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
    },
  });
}

export function useUpdateBadge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ComplianceBadgeInput> }) => {
      const res = await api.put(`/compliance/${id}`, data);
      return res.data.badge as ComplianceBadge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-badges'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
    },
  });
}

export function useDeleteBadge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/compliance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-badges'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
    },
  });
}

export function useReorderBadges() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (badgeIds: string[]) => {
      const res = await api.put('/compliance/reorder', { badgeIds });
      return res.data.badges as ComplianceBadge[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-badges'] });
    },
  });
}

// Public hooks (no auth required)
export function usePublicTrustPage(organizationId: string) {
  return useQuery({
    queryKey: ['trust-page', organizationId],
    queryFn: async () => {
      const res = await api.get(`/compliance/public/${organizationId}/trust-page`);
      return res.data as {
        companyName: string;
        logoUrl: string | null;
        primaryColor: string;
        badges: ComplianceBadge[];
      };
    },
    enabled: !!organizationId,
  });
}
