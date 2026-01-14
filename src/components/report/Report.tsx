import type { Assessment, Finding, Severity } from "@prisma/client";
import { SentinelStackLogo } from "@/lib/icons";
import { getSeverityCounts } from "@/services/riskScoring.service";

type ReportProps = {
  assessment: Assessment & { findings: Finding[] };
};

const severityColors: Record<Severity, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#6b7280',
};

const severityOrder: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

const formatDate = (date: Date) => new Date(date).toLocaleDateString();

const summarizeText = (text: string, maxLen: number) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  const clipped = normalized.slice(0, maxLen);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(0, lastSpace)).trim()}…`;
};

const getRiskScoreColor = (score: number) => {
    if (score > 80) return "text-red-600";
    if (score > 60) return "text-orange-600";
    if (score > 40) return "text-yellow-600";
    return "text-green-600";
};

const getRiskTier = (score: number | null) => {
  if (score === null) return { label: 'Not Scored', color: 'text-gray-700' };
  if (score > 80) return { label: 'Critical', color: 'text-red-700' };
  if (score > 60) return { label: 'High', color: 'text-orange-700' };
  if (score > 40) return { label: 'Medium', color: 'text-yellow-700' };
  return { label: 'Low', color: 'text-green-700' };
};

const getFindingCode = (index: number) => `F-${String(index + 1).padStart(3, '0')}`;

export default function Report({ assessment }: ReportProps) {
  const { name, targetUrl, createdAt, riskScore, findings } = assessment;
  const summary = getSeverityCounts(findings);

  const generatedAt = new Date();
  const riskTier = getRiskTier(riskScore ?? null);
  const sortedFindings = [...findings].sort((a, b) => {
    const bySeverity = severityOrder[a.severity] - severityOrder[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.title.localeCompare(b.title);
  });
  const topFindings = sortedFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').slice(0, 6);
  const totalFindings = findings.length;
  const findingsBySeverity = (Object.keys(severityOrder) as Severity[]).reduce((acc, sev) => {
    acc[sev] = findings.filter(f => f.severity === sev).length;
    return acc;
  }, {} as Record<Severity, number>);

  return (
    <div className="bg-white text-black font-sans">
      <style>{`
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pdf-break-before { break-before: page; page-break-before: always; }
        .pdf-break-after { break-after: page; page-break-after: always; }
        .pdf-avoid-break { break-inside: avoid; page-break-inside: avoid; }
        .pdf-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      `}</style>

      {/* Cover */}
      <section className="px-12 py-14 pdf-break-after">
        <div className="-mx-12 -mt-14 bg-gradient-to-r from-blue-600 to-indigo-800 text-primary-foreground px-12 py-10">
          <div className="flex items-start justify-between">
            <div className="max-w-xl">
              <p className="text-xs tracking-widest uppercase opacity-90">Security Assessment Report</p>
              <h1 className="mt-2 text-5xl font-bold font-headline">{name}</h1>
              <p className="mt-3 text-base opacity-90">Prepared by Sentinel Stack Platform</p>
            </div>
            <div className="pt-1">
              <SentinelStackLogo width={240} />
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 text-sm">
          <div className="rounded-lg border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assessment Details</p>
            <dl className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <dt className="text-xs text-gray-500">Target</dt>
                <dd className="text-sm font-medium text-gray-900 break-words">{targetUrl}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-gray-500">Assessment Date</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Generated</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(generatedAt)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Classification</dt>
                <dd className="text-sm font-medium text-gray-900">Confidential</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Executive Snapshot</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-[10px] text-gray-500">Overall Risk Score</p>
                <p className={`mt-1 text-4xl font-bold ${getRiskScoreColor(riskScore ?? 0)}`}>{riskScore ?? 'N/A'}</p>
                <p className={`mt-1 text-xs font-semibold ${riskTier.color}`}>{riskTier.label}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-[10px] text-gray-500">Total Findings</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{totalFindings}</p>
                <div className="mt-2 text-xs text-gray-700 space-y-1">
                  <div className="flex items-center justify-between"><span>Critical</span><span className="font-semibold" style={{ color: severityColors.CRITICAL }}>{findingsBySeverity.CRITICAL}</span></div>
                  <div className="flex items-center justify-between"><span>High</span><span className="font-semibold" style={{ color: severityColors.HIGH }}>{findingsBySeverity.HIGH}</span></div>
                  <div className="flex items-center justify-between"><span>Medium</span><span className="font-semibold" style={{ color: severityColors.MEDIUM }}>{findingsBySeverity.MEDIUM}</span></div>
                  <div className="flex items-center justify-between"><span>Low</span><span className="font-semibold" style={{ color: severityColors.LOW }}>{findingsBySeverity.LOW}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-xs text-gray-600">
          <p><span className="font-semibold">Disclaimer:</span> This report reflects findings based on the assessed scope at the time of execution. Remediation should be validated in your environment before deployment.</p>
        </div>
      </section>

      {/* Executive Summary */}
      <section className="px-12 py-10">
        <h2 className="text-2xl font-bold font-headline text-gray-900">Executive Summary</h2>
        <div className="mt-3 border-b border-gray-200" />

        <div className="mt-6 grid grid-cols-3 gap-6 text-sm">
          <div className="col-span-2">
            <p className="text-gray-700 leading-relaxed">
              This report summarizes the security assessment performed against <span className="font-semibold">{targetUrl}</span> on <span className="font-semibold">{formatDate(createdAt)}</span>. The assessment leveraged automated tooling to identify vulnerabilities and misconfigurations. The overall risk score of{' '}
              <span className={`font-semibold ${getRiskScoreColor(riskScore ?? 0)}`}>{riskScore ?? 'N/A'}</span>{' '}
              indicates the aggregated severity of findings.
            </p>
            <div className="mt-5 rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Scope & Methodology</p>
              <ul className="mt-3 list-disc list-inside space-y-1 text-gray-700 text-sm">
                <li>Automated assessment using configured tools/presets</li>
                <li>Findings prioritized by severity and business impact</li>
                <li>Remediation guidance provided per finding</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Findings Breakdown</p>
            <div className="mt-3 space-y-2 text-sm">
              {(Object.keys(severityOrder) as Severity[]).filter(s => s !== 'INFO').map(severity => (
                <div key={severity} className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{severity}</span>
                  <span className="font-bold" style={{ color: severityColors[severity] }}>{summary?.[severity] ?? 0}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="font-medium text-gray-700">Info</span>
                <span className="font-bold" style={{ color: severityColors.INFO }}>{summary?.INFO ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Findings */}
      <section className="px-12 py-10">
        <h2 className="text-2xl font-bold font-headline text-gray-900">Top Priority Findings</h2>
        <div className="mt-3 border-b border-gray-200" />

        {topFindings.length === 0 ? (
          <p className="mt-6 text-gray-700">No Critical or High findings were identified in this assessment.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {topFindings.map((finding, idx) => (
              <div
                key={finding.id}
                className="rounded-lg border border-gray-200 bg-white p-5 pdf-avoid-break"
                style={{ borderLeftWidth: 6, borderLeftColor: severityColors[finding.severity] }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-widest uppercase text-gray-500">{getFindingCode(idx)} • {finding.toolName}</p>
                    <h3 className="mt-1 text-lg font-bold text-gray-900">{finding.title}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-gray-500">Severity</p>
                    <p className="text-sm font-bold" style={{ color: severityColors[finding.severity] }}>{finding.severity}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-600">Summary</p>
                    <p className="mt-1 text-gray-700 leading-relaxed">{summarizeText(finding.description, 220)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600">Recommended Action</p>
                    <p className="mt-1 text-gray-700 leading-relaxed">{summarizeText(finding.remediation, 220)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Remediation Roadmap */}
      <section className="px-12 py-10 pdf-break-before">
        <h2 className="text-2xl font-bold font-headline text-gray-900">Remediation Roadmap</h2>
        <div className="mt-3 border-b border-gray-200" />

        <p className="mt-4 text-sm text-gray-700">
          The following roadmap provides a practical, time-bound plan to reduce risk quickly while maintaining operational stability.
        </p>

        <div className="mt-6 space-y-6 text-sm">
          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900">0–30 Days (Critical & High)</h3>
            <ul className="mt-3 list-disc list-inside space-y-2 text-gray-700">
              {sortedFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').slice(0, 12).map(f => (
                <li key={f.id}><span className="font-semibold">{f.title}:</span> {summarizeText(f.remediation, 140)}</li>
              ))}
              {sortedFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length === 0 && (
                <li>No Critical or High findings.</li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900">31–60 Days (Medium)</h3>
            <ul className="mt-3 list-disc list-inside space-y-2 text-gray-700">
              {sortedFindings.filter(f => f.severity === 'MEDIUM').slice(0, 12).map(f => (
                <li key={f.id}><span className="font-semibold">{f.title}:</span> {summarizeText(f.remediation, 140)}</li>
              ))}
              {sortedFindings.filter(f => f.severity === 'MEDIUM').length === 0 && (
                <li>No Medium findings.</li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900">61–90 Days (Low & Info)</h3>
            <ul className="mt-3 list-disc list-inside space-y-2 text-gray-700">
              {sortedFindings.filter(f => f.severity === 'LOW' || f.severity === 'INFO').slice(0, 12).map(f => (
                <li key={f.id}><span className="font-semibold">{f.title}:</span> {summarizeText(f.remediation || 'Review and implement as part of regular maintenance.', 140)}</li>
              ))}
              {sortedFindings.filter(f => f.severity === 'LOW' || f.severity === 'INFO').length === 0 && (
                <li>No Low/Info findings.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Appendix */}
      <section className="px-12 py-10 pdf-break-before">
        <h2 className="text-2xl font-bold font-headline text-gray-900">Appendix: Detailed Findings</h2>
        <div className="mt-3 border-b border-gray-200" />

        <div className="mt-6 space-y-6">
          {sortedFindings.map((finding, idx) => (
            <div key={finding.id} className="rounded-lg border border-gray-200 p-5 pdf-avoid-break">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-gray-500">{getFindingCode(idx)} • {finding.toolName}</p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900">{finding.title}</h3>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-500">Severity</p>
                  <p className="text-sm font-bold" style={{ color: severityColors[finding.severity] }}>{finding.severity}</p>
                </div>
              </div>

              {finding.complianceMapping?.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  <span className="font-semibold">Compliance:</span> {finding.complianceMapping.join(', ')}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Description</h4>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{finding.description}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Remediation</h4>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{finding.remediation}</p>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Evidence</h4>
                <pre className="mt-2 text-[11px] bg-gray-50 border border-gray-200 p-3 rounded-md overflow-x-auto pdf-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(finding.evidence, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-12 pb-10 pt-8 mt-10 border-t text-center text-xs text-gray-500">
        <p className="font-semibold">Sentinel Stack Security Report • Confidential</p>
        <p className="mt-1">This report is intended solely for the designated recipient and may contain confidential information.</p>
      </footer>
    </div>
  );
}
