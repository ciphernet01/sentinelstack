'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import api from '@/lib/api';
import RiskAnalyticsView from '@/components/dashboard/RiskAnalyticsView';
import { useToast } from '@/hooks/use-toast';

export default function RiskAnalyticsPage() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['riskAnalytics'],
    queryFn: async () => {
      const res = await api.get('/dashboard/analytics');
      return res.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load risk analytics',
        description: 'There was an error fetching analytics from the server. Please try again later.',
      });
    }
  }, [error, toast]);

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline text-primary-foreground">Risk Analytics</h1>
        <p className="text-muted-foreground">Deeper risk trends, distributions, and hotspots</p>
      </div>

      {isLoading && (
        <div className="flex h-full w-full items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {data && !isLoading && <RiskAnalyticsView data={data} />}

      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed rounded-lg bg-card mt-4">
          <p className="text-destructive-foreground font-semibold">Unable to Load Risk Analytics</p>
          <p className="text-muted-foreground text-sm mt-2">Could not connect to the Sentinel Stack backend.</p>
          <p className="text-muted-foreground text-xs mt-1">Please ensure the server is running.</p>
        </div>
      )}
    </div>
  );
}
