'use client';

import React from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar';
import withAuth from '@/components/auth/withAuth';

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#02080b] text-slate-100">
      <DashboardTopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
      />

      <div className="relative min-h-[calc(100vh-60px)] w-full flex-1 overflow-x-hidden overflow-y-visible">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          className={
            `relative min-h-[calc(100vh-60px)] w-full min-w-0 bg-[#02080b] will-change-transform ` +
            `transition-transform duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ` +
            (sidebarOpen ? 'translate-x-[252px]' : 'translate-x-0')
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default withAuth(DashboardLayout);
