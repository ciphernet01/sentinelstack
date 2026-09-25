import type { Metadata } from 'next';
import SentinelLandingPage from '@/components/landing/SentinelLandingPage';

export const metadata: Metadata = {
  title: 'SentinelStack — Enterprise Security Assessment Platform',
  description: 'Audit-ready security in weeks, not quarters. SentinelStack helps SaaS teams automate security assessments, map findings to compliance frameworks, and create reports customers and auditors can trust.',
};

export default function Home() {
  return <SentinelLandingPage />;
}
