import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Assessment, Finding } from '@prisma/client';

import PrintReport from '@/components/report/PrintReport';

type PageProps = {
  params: { id: string };
};

type AssessmentForPrint = Assessment & { findings: Finding[] };

function coerceToDates(raw: any): AssessmentForPrint {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    findings: (raw.findings || []).map((f: any) => ({
      ...f,
      createdAt: new Date(f.createdAt),
      updatedAt: new Date(f.updatedAt),
    })),
  } as AssessmentForPrint;
}

export default async function PrintReportPage({ params }: PageProps) {
  const secret = process.env.PDF_RENDER_SECRET;
  const incoming = headers().get('x-internal-secret');

  if (!secret || incoming !== secret) {
    notFound();
  }

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  if (!host) notFound();

  const baseUrl = `${proto}://${host}`;
  const res = await fetch(`${baseUrl}/api/internal/assessments/${params.id}/report`, {
    headers: {
      'x-internal-secret': secret,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    notFound();
  }

  const json = await res.json();
  const assessment = coerceToDates(json);

  return <PrintReport assessment={assessment} />;
}
