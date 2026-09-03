'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ExecutiveRiskOverview } from '@/components/dashboard/ExecutiveRiskOverview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCyberRisk } from '@/hooks/use-cyber-risk';
import { usePageTitle } from '@/hooks/use-page-title';
import api from '@/lib/api';

const DEFAULT_BUDGET_INR = 10_000_000;

function formatBudgetLabel(value: number) {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export default function RiskIntelligencePage() {
  usePageTitle('Risk Intelligence');

  const [budgetInr, setBudgetInr] = useState(DEFAULT_BUDGET_INR);
  const [draftBudget, setDraftBudget] = useState(String(DEFAULT_BUDGET_INR));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useCyberRisk(budgetInr);

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/cyber-risk/snapshots', { budgetInr });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Risk snapshot saved',
        description: 'The current financial risk calculation is now available for trends and reports.',
      });
      queryClient.invalidateQueries({ queryKey: ['cyberRiskEnterprise'] });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Snapshot failed',
        description: err?.response?.data?.message || err?.message || 'Could not save the risk snapshot.',
      });
    },
  });

  const applyBudget = () => {
    const parsed = Number.parseInt(draftBudget, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid budget',
        description: 'Enter a positive budget amount in INR.',
      });
      return;
    }
    setBudgetInr(parsed);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 space-y-5 p-3 sm:p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-xl font-bold font-headline text-primary-foreground sm:text-2xl">
              Cyber Risk Intelligence
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quantify exposure in rupees, simulate control changes, and optimize security spend.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="risk-budget" className="text-xs text-muted-foreground">
                Optimization budget
              </Label>
              <div className="flex gap-2">
                <Input
                  id="risk-budget"
                  inputMode="numeric"
                  value={draftBudget}
                  onChange={(event) => setDraftBudget(event.target.value)}
                  className="w-[180px]"
                />
                <Button type="button" variant="outline" onClick={applyBudget}>
                  Apply
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">Current: {formatBudgetLabel(budgetInr)}</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button type="button" onClick={() => snapshotMutation.mutate()} disabled={!data || snapshotMutation.isPending}>
                {snapshotMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Snapshot
              </Button>
            </div>
          </div>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating enterprise cyber risk...
            </CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Risk Intelligence Needs Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Ingest enterprise asset telemetry, control coverage, vulnerability data, and threat signals before opening this view.
              </p>
              <code className="block rounded-md bg-muted p-3 text-xs text-foreground">
                npm run prisma:deploy:host
              </code>
            </CardContent>
          </Card>
        )}

        {data && !isLoading && <ExecutiveRiskOverview data={data} />}
      </div>
    </div>
  );
}
