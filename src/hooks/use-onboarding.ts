'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface OnboardingStatus {
  onboardingComplete: boolean;
  hasAssessments: boolean;
}

export function useOnboardingStatus() {
  return useQuery<OnboardingStatus>({
    queryKey: ['onboardingStatus'],
    queryFn: async () => {
      const response = await api.get('/auth/onboarding-status');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/auth/complete-onboarding');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
    },
  });
}
