
'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, Bell, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useAuth } from '@/context/AuthContext';
import { Overview } from '@/components/dashboard/Overview';
import withAuth from '@/components/auth/withAuth';
import type { Assessment, Finding } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import Link from 'next/link';
import { usePageTitle } from '@/hooks/use-page-title';
import { UsageIndicator } from '@/components/billing/UsageIndicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar-1');

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
  }
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

function DashboardPage() {
    usePageTitle('Dashboard');

    const { user } = useAuth();
    const { toast } = useToast();

    const { data, isLoading, error } = useQuery<DashboardData, Error>({
      queryKey: ['dashboardData'],
      queryFn: async () => {
        const response = await api.get('/dashboard/summary');
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
            enabled: Boolean(isPlatformAdmin),
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
                description: 'There was an error fetching data from the server. Please try again later.'
            });
        }
    }, [error, toast]);


    return (
        <div className="flex flex-col flex-1 min-h-screen w-full max-w-full">
            <div className="flex-1 p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 w-full max-w-full">
                <div>
                     <h1 className="text-xl sm:text-2xl font-bold font-headline text-primary-foreground">Security Intelligence Dashboard</h1>
                     <p className="text-muted-foreground text-sm sm:text-base">Real-time risk assessment and security posture analysis</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
                    <UsageIndicator compact className="order-2 sm:order-1" />
                    <Button variant="outline" className="w-full sm:w-auto order-1 sm:order-2">
                        <FileDown className="mr-2 h-4 w-4" />
                        Export PDF Report
                    </Button>
                </div>

                                {isPlatformAdmin && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium">Scan Queue Health</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isScanQueueLoading && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading queue stats…
                                                </div>
                                            )}

                                            {!isScanQueueLoading && scanQueueStats && (
                                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Queued</div>
                                                        <div className="text-lg font-semibold">{scanQueueStats.counts.QUEUED || 0}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Running</div>
                                                        <div className="text-lg font-semibold">{scanQueueStats.counts.RUNNING || 0}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Failed</div>
                                                        <div className="text-lg font-semibold">{scanQueueStats.counts.FAILED || 0}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Runnable</div>
                                                        <div className="text-lg font-semibold">{scanQueueStats.runnableQueued}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">Oldest (sec)</div>
                                                        <div className="text-lg font-semibold">{scanQueueStats.oldestQueuedAgeSeconds}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                 {isLoading && (
                     <div className="flex h-full w-full items-center justify-center p-8 sm:p-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {data && !isLoading && (
                    <>
                        {data.stats.totalAssessments === 0 && (
                            <div className="rounded-lg border border-dashed bg-card p-4 sm:p-5">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="font-semibold">Run your first preset</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Start with the Broken Access Control (IDOR) preset and get a clean report you can share.
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 mt-3 md:mt-0">
                                        <Button asChild className="w-full sm:w-auto">
                                            <Link href="/dashboard/onboarding">Get started</Link>
                                        </Button>
                                        <Button asChild variant="outline" className="w-full sm:w-auto">
                                            <Link href="/dashboard/assessments/new">New assessment</Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <Overview stats={data.stats} recentAssessments={data.recentAssessments} findingsOverTime={data.findingsOverTime} />
                    </>
                )}

                {error && !isLoading && (
                    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-16 border-2 border-dashed rounded-lg bg-card mt-4">
                        <p className="text-destructive-foreground font-semibold">Unable to Load Dashboard</p>
                        <p className="text-muted-foreground text-sm mt-2">Could not connect to the Sentinel Stack backend.</p>
                        <p className="text-muted-foreground text-xs mt-1">Please ensure the server is running.</p>
                    </div>
                )}

            </div>

            {/* Bottom Status Bar */}
            <footer className="mt-auto border-t border-border bg-card p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3 sm:gap-0 w-full">
                <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-0">
                     <ThemeToggle />
                    <Button variant="ghost" size="icon">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground">System Active</span>
                    </div>
                </div>
                {user && (
                     <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-right">
                             <p className="text-xs sm:text-sm font-semibold text-primary-foreground">{user.name}</p>
                             <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User Avatar" data-ai-hint={userAvatar.imageHint} />}
                            <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                    </div>
                )}
            </footer>
        </div>
    );
}

export default withAuth(DashboardPage);
