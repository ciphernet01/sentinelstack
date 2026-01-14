'use client';
import React from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import withAuth from '@/components/auth/withAuth';

function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full bg-background">
            <Sidebar />
            <main className="flex-1 flex flex-col">
                {children}
            </main>
        </div>
    );
}

export default withAuth(DashboardLayout);
