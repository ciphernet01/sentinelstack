'use client';

import Image from 'next/image';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeAwarePublicLogo({ width = 200 }: { width?: number }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => setMounted(true), []);

  return (
    <Image
      src={isDark ? '/branding/sentinelstack-logo.png' : '/branding/sentinelstack-logo-dark.png'}
      alt="SentinelStack Logo"
      width={width}
      height={Math.max(1, Math.round((width * 6) / 16))}
      priority
    />
  );
}

export function ThemeModeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-px hover:border-blue-300 hover:text-blue-700 dark:border-white/15 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-blue-400/50 dark:hover:text-blue-200 ${className}`}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to day mode' : 'Switch to night mode'}
    >
      {isDark ? <Moon className="h-4 w-4 text-sky-300" aria-hidden="true" /> : <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />}
      <span className="hidden sm:inline">{isDark ? 'Night' : 'Day'}</span>
    </button>
  );
}
