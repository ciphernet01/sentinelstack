import type { Metadata } from 'next';
import { Inter, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppProviders } from '@/components/layout/AppProviders';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { ChatWidget } from '@/components/chat/ChatWidget';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'SentinelStack | Enterprise Security Assessment Platform',
    template: '%s | SentinelStack',
  },
  description: 'Real-time risk assessment and security posture analysis',
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Add 1024x1024 PNG favicon for modern browsers */}
        <link rel="icon" type="image/png" sizes="1024x1024" href="/branding/favicon-1024.png" />
      </head>
      <body className={`${inter.variable} ${sourceCodePro.variable} font-body antialiased`}>
        <AppProviders>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <ChatWidget />
            <Toaster />
          </ThemeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
