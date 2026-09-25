import * as React from 'react';
import { cn } from '@/lib/utils';

type CyberPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  accent?: 'cyan' | 'critical' | 'warning' | 'success';
};

const accentClasses = {
  cyan: 'before:bg-cyan-300/70',
  critical: 'before:bg-rose-400/80',
  warning: 'before:bg-amber-300/80',
  success: 'before:bg-emerald-300/80',
};

export function CyberPanel({
  className,
  accent = 'cyan',
  children,
  ...props
}: CyberPanelProps) {
  return (
    <section
      className={cn(
        'cyber-panel relative overflow-hidden rounded-xl border border-cyan-300/[0.10] bg-[#071317]/[0.90] shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-md',
        'before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-px before:w-20 before:content-[""]',
        accentClasses[accent],
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CyberPanelHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.055] px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-200/50">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CyberStatusDot({
  tone = 'cyan',
  pulse = false,
}: {
  tone?: 'cyan' | 'green' | 'amber' | 'red';
  pulse?: boolean;
}) {
  const classes = {
    cyan: 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.75)]',
    green: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]',
    amber: 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.7)]',
    red: 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.75)]',
  }[tone];

  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      {pulse ? (
        <span className={cn('absolute inset-0 animate-ping rounded-full opacity-40', classes)} />
      ) : null}
      <span className={cn('relative h-1.5 w-1.5 rounded-full', classes)} />
    </span>
  );
}
