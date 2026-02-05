'use client';

import { useSubscriptionUsage } from '@/hooks/use-subscription';
import { cn } from '@/lib/utils';
import { Zap, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface UsageIndicatorProps {
  className?: string;
  showUpgradeLink?: boolean;
  compact?: boolean;
}

export function UsageIndicator({ className, showUpgradeLink = true, compact = false }: UsageIndicatorProps) {
  const { data, isLoading } = useSubscriptionUsage();

  if (isLoading || !data) {
    return null;
  }

  const { usage, limits } = data;
  const isUnlimited = usage.scansRemaining === 'unlimited';
  const scansUsed = usage.scansUsed;
  const scansLimit = usage.scansLimit;
  const scansRemaining = isUnlimited ? Infinity : (usage.scansRemaining as number);
  
  // Calculate percentage for progress bar
  const percentage = isUnlimited ? 0 : Math.min(100, (scansUsed / scansLimit) * 100);
  
  // Determine status
  const isLow = !isUnlimited && scansRemaining <= 1;
  const isWarning = !isUnlimited && scansRemaining <= Math.ceil(scansLimit * 0.2) && !isLow;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <Zap className={cn(
          'w-4 h-4',
          isLow ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'
        )} />
        <span className="text-slate-400">
          {isUnlimited ? (
            'Unlimited scans'
          ) : (
            <>
              <span className={cn(
                'font-medium',
                isLow ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
              )}>
                {scansRemaining}
              </span>
              {' scans left'}
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('bg-slate-800/50 rounded-lg border border-slate-700 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLow ? (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          ) : (
            <Zap className="w-4 h-4 text-cyan-400" />
          )}
          <span className="text-sm font-medium text-white">Scan Usage</span>
        </div>
        {showUpgradeLink && !isUnlimited && (
          <Link 
            href="/pricing" 
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            Upgrade
          </Link>
        )}
      </div>

      {isUnlimited ? (
        <div className="text-sm text-slate-300">
          <span className="text-cyan-400 font-semibold">Unlimited</span> scans available
        </div>
      ) : (
        <>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">
              {scansUsed} / {scansLimit} scans used
            </span>
            <span className={cn(
              'font-medium',
              isLow ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-slate-300'
            )}>
              {scansRemaining} remaining
            </span>
          </div>
          
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                isLow 
                  ? 'bg-red-500' 
                  : isWarning 
                    ? 'bg-amber-500' 
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {isLow && (
            <p className="text-xs text-red-400 mt-2">
              You&apos;re running low on scans. Upgrade for more.
            </p>
          )}
        </>
      )}
    </div>
  );
}
