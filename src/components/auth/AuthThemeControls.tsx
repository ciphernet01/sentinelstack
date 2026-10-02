'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './AuthPage.module.css';

export function AuthBrand() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => setMounted(true), []);

  return (
    <Image
      src={isDark ? '/branding/sentinelstack-logo.png' : '/branding/sentinelstack-logo-dark.png'}
      alt="SentinelStack"
      width={172}
      height={47}
      priority
    />
  );
}

export function AuthThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to day mode' : 'Switch to night mode'}
    >
      <Sun className={styles.themeSun} size={16} aria-hidden="true" />
      <Moon className={styles.themeMoon} size={16} aria-hidden="true" />
      <span>{isDark ? 'Night' : 'Day'}</span>
    </button>
  );
}
