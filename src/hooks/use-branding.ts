'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Branding {
  id: string;
  organizationId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  customDomain: string | null;
  domainVerified: boolean;
  domainVerifyToken: string | null;
  emailFromName: string | null;
  emailReplyTo: string | null;
  reportLogoUrl: string | null;
  reportFooterText: string | null;
  reportHeaderText: string | null;
  hidePoweredBy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBranding {
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  hidePoweredBy: boolean;
}

export interface BrandingUpdateData {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  companyName?: string | null;
  primaryColor?: string;
  secondaryColor?: string | null;
  accentColor?: string | null;
  customDomain?: string | null;
  emailFromName?: string | null;
  emailReplyTo?: string | null;
  reportLogoUrl?: string | null;
  reportFooterText?: string | null;
  reportHeaderText?: string | null;
  hidePoweredBy?: boolean;
}

export interface DomainVerificationInfo {
  domain: string;
  verified: boolean;
  instructions: {
    recordType: string;
    recordName: string;
    recordValue: string;
    note: string;
  };
}

export function useBranding() {
  return useQuery<Branding | null>({
    queryKey: ['branding'],
    queryFn: async () => {
      const response = await api.get('/branding');
      return response.data.branding;
    },
  });
}

export function usePublicBranding() {
  return useQuery<PublicBranding | null>({
    queryKey: ['branding', 'public'],
    queryFn: async () => {
      const response = await api.get('/branding/public');
      return response.data.branding;
    },
  });
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: BrandingUpdateData) => {
      const response = await api.put('/branding', data);
      return response.data.branding as Branding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    },
  });
}

export function useVerifyDomain() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/branding/domain/verify');
      return response.data as { verified: boolean; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    },
  });
}

export function useDomainVerificationInfo() {
  return useQuery<DomainVerificationInfo | null>({
    queryKey: ['branding', 'domain', 'verify'],
    queryFn: async () => {
      try {
        const response = await api.get('/branding/domain/verify');
        return response.data;
      } catch {
        return null;
      }
    },
  });
}

export function useResetBranding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await api.delete('/branding');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
    },
  });
}

// Default branding values
export const DEFAULT_BRANDING: PublicBranding = {
  logoUrl: null,
  faviconUrl: null,
  companyName: 'SentinelStack',
  primaryColor: '#6366f1',
  secondaryColor: null,
  accentColor: null,
  hidePoweredBy: false,
};
