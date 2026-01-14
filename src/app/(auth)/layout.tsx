import React from 'react';
import Link from 'next/link';
import { SentinelStackLogo } from '@/lib/icons';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-12">
            <div className="absolute top-8 left-8">
                 <Link href="/" className="flex items-center">
                    <SentinelStackLogo width={200}/>
                </Link>
            </div>
            <div className="w-full max-w-2xl">
              {children}
            </div>
             <div className="mt-8 text-center text-sm text-muted-foreground">
                Enterprise Inquiries? <a href="mailto:sales@sentinelstack.com" className="text-primary underline">Contact sales@sentinelstack.com</a>
            </div>
        </div>
    );
}
