import type { Assessment, Finding, Severity } from "@prisma/client";
import { SentinelStackLogo } from "@/lib/icons";
import { getSeverityCounts } from "@/services/riskScoring.service";

type PrintReportProps = {
  assessment: Assessment & { findings: Finding[] };
};

const severityOrder: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

const severityColors: Record<Severity, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  INFO: "#6b7280",
};

const formatDate = (date: Date) => new Date(date).toLocaleDateString();

const summarizeText = (text: string, maxLen: number) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const clipped = normalized.slice(0, maxLen);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, Math.max(0, lastSpace)).trim()}…`;
};

const getFindingCode = (index: number) => `F-${String(index + 1).padStart(3, "0")}`;

const getRiskTier = (score: number | null) => {
  if (score === null) return "Not Scored";
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 40) return "Medium";
  return "Low";
};

function Page({ children }: { children: React.ReactNode }) {
  return <section className="pdf-page">{children}</section>;
}

export default function PrintReport({ assessment }: PrintReportProps) {
  const { name, targetUrl, createdAt, riskScore, findings } = assessment;
  const generatedAt = new Date();

  const sortedFindings = [...findings].sort((a, b) => {
    const bySeverity = severityOrder[a.severity] - severityOrder[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.title.localeCompare(b.title);
  });

  const topFindings = sortedFindings
    .filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
    .slice(0, 8);

  const topChallenges = sortedFindings
    .filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
    .slice(0, 4);

  const severityCounts = getSeverityCounts(findings);
  const totalFindings = findings.length;

  const recommendedActions = sortedFindings
    .filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
    .slice(0, 4)
    .map((f) => ({ id: f.id, title: f.title, remediation: f.remediation || "" }));

  return (
    <div className="bg-white text-black font-sans">
      <style>{`
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        /* Avoid capturing dev overlays or UI toasts in PDFs */
        nextjs-portal,
        #__nextjs__overlay,
        #__next-build-watcher,
        [data-radix-toast-viewport] {
          display: none !important;
        }

        /* Force a light document background (avoids dark theme bleed into margins) */
        :root { color-scheme: light; }
        html, body { background: #ffffff !important; }

        /* Use A4 portrait for a more traditional report */
        @page { size: A4; }

        html, body { background: white; }

        .pdf-page { page-break-after: always; break-after: page; box-sizing: border-box; }
        .pdf-page:last-of-type { page-break-after: auto; break-after: auto; }
        .pdf-avoid-break { break-inside: avoid; page-break-inside: avoid; }

        .pdf-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      `}</style>

      {/* Page 1: Cover */}
      <Page>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs tracking-widest uppercase text-gray-500">Security Assessment Report</div>
            <div className="mt-3 text-[32px] leading-tight font-bold text-gray-900">{name}</div>
            <div className="mt-3 text-sm text-gray-700">Prepared by Sentinel Stack Platform</div>
          </div>
          <div className="pt-1">
            <SentinelStackLogo width={210} />
          </div>
        </div>

        <div className="mt-6 h-px w-full bg-gray-200" />

        <div className="mt-8 grid grid-cols-2 gap-8">
          <div className="pdf-avoid-break">
            <div className="text-lg font-bold text-gray-900">Assessment Details</div>
            <div className="mt-4 grid grid-cols-[140px_1fr] gap-x-4 gap-y-2">
              <div className="text-xs text-gray-500">Target</div>
              <div className="text-sm font-semibold text-gray-900 break-words">{targetUrl}</div>

              <div className="text-xs text-gray-500">Assessment date</div>
              <div className="text-sm font-semibold text-gray-900">{formatDate(createdAt)}</div>

              <div className="text-xs text-gray-500">Report generated</div>
              <div className="text-sm font-semibold text-gray-900">{formatDate(generatedAt)}</div>

              <div className="text-xs text-gray-500">Classification</div>
              <div className="text-sm font-semibold text-gray-900">Confidential</div>
            </div>
          </div>

          <div className="pdf-avoid-break">
            <div className="text-lg font-bold text-gray-900">Executive Snapshot</div>
            <div className="mt-4 grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500">Overall risk score</div>
                <div className="mt-2 text-4xl font-bold text-gray-900">{riskScore ?? "N/A"}</div>
                <div className="mt-1">
                  <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-gray-900">
                    {getRiskTier(riskScore ?? null)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total findings</div>
                <div className="mt-2 text-4xl font-bold text-gray-900">{totalFindings}</div>
              </div>
            </div>

            <div className="mt-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700">Severity</th>
                    <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700" style={{ width: "120px" }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(severityOrder) as Severity[]).map((sev) => (
                    <tr key={sev}>
                      <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">
                        <span className="font-semibold" style={{ color: severityColors[sev] }}>{sev}</span>
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">{severityCounts?.[sev] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-gray-600">
          <span className="font-semibold">Disclaimer:</span> This report reflects automated findings within the configured scope and time window. Validate remediation in your environment before rollout.
        </div>
      </Page>

      {/* Page 2: Executive summary */}
      <Page>
        <div className="text-lg font-bold text-gray-900">Executive Summary</div>
        <div className="mt-3 h-px w-full bg-gray-200" />

        <div className="mt-5 text-sm text-gray-700 leading-relaxed">
          This report summarizes the automated security assessment performed against{" "}
          <span className="font-semibold">{targetUrl}</span> on <span className="font-semibold">{formatDate(createdAt)}</span>.
          It highlights key risks, current challenges, actions taken, and a prioritized remediation plan.
        </div>

        <div className="mt-7 grid grid-cols-2 gap-8">
          <div className="pdf-avoid-break">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Key findings</div>
            <div className="mt-3 rounded-md border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Risk profile</div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Overall risk score</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{riskScore ?? "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total findings</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{totalFindings}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2 text-center text-[11px]">
                {(Object.keys(severityOrder) as Severity[]).map((sev) => (
                  <div key={sev} className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="font-semibold" style={{ color: severityColors[sev] }}>{sev}</div>
                    <div className="mt-1 font-bold text-gray-900">{severityCounts?.[sev] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pdf-avoid-break">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current challenges</div>
            <div className="mt-3 rounded-md border border-gray-200 p-4">
              {topChallenges.length === 0 ? (
                <div className="text-sm text-gray-700">No Critical/High issues were identified in this assessment.</div>
              ) : (
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                  {topChallenges.map((f) => (
                    <li key={f.id}>
                      <span className="font-semibold" style={{ color: severityColors[f.severity] }}>{f.severity}</span>: {summarizeText(f.title, 95)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-8">
          <div className="pdf-avoid-break">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Actions taken</div>
            <div className="mt-3 rounded-md border border-gray-200 p-4">
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li>Automated scanners executed within the configured scope</li>
                <li>Findings normalized with severity, evidence, and remediation</li>
                <li>Prioritized roadmap generated for remediation planning</li>
              </ul>
            </div>
          </div>

          <div className="pdf-avoid-break">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recommended action plan</div>
            <div className="mt-3 rounded-md border border-gray-200 p-4">
              {recommendedActions.length === 0 ? (
                <div className="text-sm text-gray-700">Maintain current controls and continue monitoring.</div>
              ) : (
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                  {recommendedActions.map((a) => (
                    <li key={a.id}>
                      <span className="font-semibold">{summarizeText(a.title, 70)}:</span> {summarizeText(a.remediation, 120)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-9 text-lg font-bold text-gray-900">Top Priority Findings</div>
        <div className="mt-3 h-px w-full bg-gray-200" />

        <div className="mt-4 text-sm text-gray-700">
          {topFindings.length === 0 ? (
            <span>No Critical or High findings were identified.</span>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700" style={{ width: "70px" }}>ID</th>
                  <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700">Title</th>
                  <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700" style={{ width: "90px" }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {topFindings.map((f, idx) => (
                  <tr key={f.id}>
                    <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900"><span className="pdf-mono">{getFindingCode(idx)}</span></td>
                    <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">
                      <div className="font-semibold">{summarizeText(f.title, 90)}</div>
                      <div className="mt-1 text-[10px] text-gray-600">{summarizeText(f.toolName, 70)}</div>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900"><span className="font-semibold" style={{ color: severityColors[f.severity] }}>{f.severity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-9 text-lg font-bold text-gray-900">Remediation Roadmap</div>
        <div className="mt-3 h-px w-full bg-gray-200" />

        <div className="mt-5">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700" style={{ width: "110px" }}>Window</th>
                <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700" style={{ width: "140px" }}>Focus</th>
                <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900"><span className="font-semibold">0–30 days</span></td>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">Critical & High</td>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">
                  {sortedFindings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").slice(0, 8).map((f) => (
                    <div key={f.id} className="mb-1">
                      <span className="font-semibold">{summarizeText(f.title, 70)}:</span> {summarizeText(f.remediation || "", 120)}
                    </div>
                  ))}
                  {sortedFindings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length === 0 && (
                    <div>No Critical/High findings.</div>
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900"><span className="font-semibold">31–60 days</span></td>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">Medium</td>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">
                  {sortedFindings.filter((f) => f.severity === "MEDIUM").slice(0, 8).map((f) => (
                    <div key={f.id} className="mb-1">
                      <span className="font-semibold">{summarizeText(f.title, 70)}:</span> {summarizeText(f.remediation || "", 120)}
                    </div>
                  ))}
                  {sortedFindings.filter((f) => f.severity === "MEDIUM").length === 0 && <div>No Medium findings.</div>}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900"><span className="font-semibold">61–90 days</span></td>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">Low & Info</td>
                <td className="border border-gray-200 px-3 py-2 text-[11px] text-gray-900">
                  {sortedFindings.filter((f) => f.severity === "LOW" || f.severity === "INFO").slice(0, 8).map((f) => (
                    <div key={f.id} className="mb-1">
                      <span className="font-semibold">{summarizeText(f.title, 70)}:</span> {summarizeText(f.remediation || "Review and implement during maintenance.", 120)}
                    </div>
                  ))}
                  {sortedFindings.filter((f) => f.severity === "LOW" || f.severity === "INFO").length === 0 && (
                    <div>No Low/Info findings.</div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Page>

      {/* Remaining pages: Detailed findings */}
      <Page>
        <div className="text-lg font-bold text-gray-900">Appendix: Detailed Findings</div>
        <div className="mt-3 h-px w-full bg-gray-200" />

        <div className="mt-6 space-y-6">
          {sortedFindings.map((f, idx) => (
            <div key={f.id} className="pdf-avoid-break">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-xs text-gray-500 tracking-widest uppercase">{getFindingCode(idx)} • {f.toolName}</div>
                  <div className="mt-1 text-base font-bold text-gray-900">{f.title}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-gray-500">Severity</div>
                  <div className="text-sm font-bold" style={{ color: severityColors[f.severity] }}>{f.severity}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-8">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Description</div>
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed">{f.description}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Remediation</div>
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed">{f.remediation}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Evidence</div>
                <pre className="mt-2 text-[10px] bg-gray-50 border border-gray-200 p-3 overflow-x-auto pdf-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(f.evidence, null, 2)}
                </pre>
              </div>

              <div className="mt-6 h-px w-full bg-gray-200" />
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          <div className="font-semibold">Sentinel Stack Security Report • Confidential</div>
          <div className="mt-1">Intended solely for the designated recipient.</div>
        </div>
      </Page>
    </div>
  );
}
