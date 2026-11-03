import React from 'react';
import Link from 'next/link';
import styles from '@/components/auth/AuthPage.module.css';
import { AuthBrand, AuthThemeToggle } from '@/components/auth/AuthThemeControls';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell} data-auth-shell>
      <div className={styles.orb} />
      <div className={styles.orbTwo} />

      <header className={styles.topbar}>
        <nav className={styles.nav} aria-label="Authentication navigation">
          <Link href="/" className={styles.logo} aria-label="SentinelStack home">
            <AuthBrand />
          </Link>
          <div className={styles.navActions}>
            <AuthThemeToggle />
            <Link href="/" className={styles.homeLink}>Back to website →</Link>
          </div>
        </nav>
      </header>

      <section className={styles.content}>{children}</section>

      <footer className={styles.footer}>
        Enterprise inquiries?{' '}
        <a href="mailto:sales@sentinelstack.com">Contact sales@sentinelstack.com</a>
      </footer>
    </main>
  );
}
