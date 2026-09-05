import type { Assessment, Finding, Severity } from "@prisma/client";
import { SentinelStackLogo } from "@/lib/icons";
import {
  SEVERITY_ORDER,
  SEVERITY_COLORS,
  SEVERITY_BG_COLORS,
  SEVERITY_WEIGHTS,
  asRecord,
  asString,
  humanizeLabel,
  formatReportDate,
  getRiskTier,
  partitionFindings,
  getManifestEvidence,
  getToolRuns,
  getCoverageSummary,
  getToolLimitations,
  getRiskMethodology,
  getPrimaryConcern,
  securityPostureStatement,
  prepareSecurityFindings,
  resolveBranding,
  resolveScanDiff,
} from "@/shared/reportUtils";

type ReportProps = {
  assessment: Assessment & { findings: Finding[] };
};

const summarizeText = (text: string, maxLen: number) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const clipped = normalized.slice(0, maxLen);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, Math.max(0, lastSpace)).trim()}…`;
};

function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 border-b border-slate-200" />
    </div>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color: SEVERITY_COLORS[severity], background: SEVERITY_BG_COLORS[severity] }}
    >
      {severity}
    </span>
  );
}

function MetricCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center" style={{ background: bg }}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SeverityBar({ severity, count, maxCount, color }: { severity: string; count: number; maxCount: number; color: string }) {
  const pct = maxCount === 0 ? 0 : Math.round((count / maxCount) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
        {severity}
      </div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-14 text-right text-sm font-bold text-slate-800">{count}</div>
    </div>
  );
}
export default function Report({ assessment }: ReportProps) {
  const { name, targetUrl, createdAt, riskScore, findings, toolPreset, scannerConfig, endedEarly, endedEarlyReason } =
    assessment as any;

  const cfg = asRecord(scannerConfig) ?? {};
  const effectivePreset = asString(cfg?.preset || toolPreset || "default");
  const scopeRaw = asString(cfg?.scope || "").trim();
  const scope = scopeRaw ? humanizeLabel(scopeRaw) : "Full";
  const runtime = asString(cfg?.runtime || "").trim() || "local";
  const timeoutMs = typeof cfg?.timeoutMs === "number" ? (cfg.timeoutMs as number) : null;
  const timeoutSource = asString(cfg?.timeoutSource).trim();
  const timeoutLabel = timeoutMs
    ? `${Math.round(timeoutMs / 1000)}s${timeoutSource ? ` (${timeoutSource})` : ""}`
    : "";
  const profileRaw = asRecord(cfg?.assessmentProfile) ?? {};
  const profileLabel =
    asString(profileRaw?.name) ||
    humanizeLabel(profileRaw?.businessCriticality) ||
    humanizeLabel(profileRaw?.environment) ||
    humanizeLabel(effectivePreset) ||
    "Enterprise";

  const generatedAt = new Date();
  const securityFindings = prepareSecurityFindings(findings, targetUrl);
  const partitioned = partitionFindings(findings);
  const methodology = getRiskMethodology(findings);
  const coverage = getCoverageSummary(findings);
  const limitations = getToolLimitations(findings);
  const toolRuns = getToolRuns(findings);
  const manifestEvidence = getManifestEvidence(findings);
  const primaryConcern = getPrimaryConcern(findings);
  const posture = securityPostureStatement(methodology.counts);
  const riskTier = getRiskTier(riskScore ?? null);
  const totalFindings = findings?.length ?? 0;
  const maxCount = Math.max(1, ...SEVERITY_ORDER.map((s) => methodology.counts[s] || 0));
  const hasNotices = coverage.hasIssues || partitioned.timeouts.length > 0 || Boolean(endedEarly);

  const orgContext = asRecord((assessment as any)?.organization);
  const brand = resolveBranding(
    (asRecord(orgContext?.branding) ?? null) as any,
    asString(orgContext?.name) || null,
  );
  const scanDiff = resolveScanDiff(cfg?.scanDiff);

  return (
    <div className="bg-white text-slate-900 font-sans">
      <style>{`
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pdf-break-before { break-before: page; page-break-before: always; }
        .pdf-break-after { break-after: page; page-break-after: always; }
        .pdf-avoid-break { break-inside: avoid; page-break-inside: avoid; }
        .pdf-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      `}</style>
{/* Cover */}
      <section className="px-10 py-12 pdf-break-after">
        <div className="-mx-10 -mt-12 px-10 py-10 text-white" style={{ background: brand.accentGradient }}>
          <div className="flex items-start justify-between">
            <div className="max-w-xl">
              <p className="text-xs tracking-widest uppercase opacity-90">{brand.headerText}</p>
              <h1 className="mt-2 text-4xl font-bold">{name}</h1>
              <p className="mt-2 text-sm opacity-90">Web Application Security Assessment</p>
              <p className="mt-3 text-xs opacity-75">Prepared by {brand.preparedBy}</p>
            </div>
            <div className="flex flex-col items-end gap-3 pt-1">
              <div className="rounded border border-red-300 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-100">
                Confidential
              </div>
              {brand.logoSrc ? (
                <img
                  src={brand.logoSrc}
                  alt={brand.clientName || 'Organization logo'}
                  className="max-h-14 max-w-[200px] rounded bg-white/95 object-contain p-1.5"
                />
              ) : (
                <SentinelStackLogo width={200} />
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div className="rounded-lg border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assessment Scope</p>
            <dl className="mt-4 grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Assessment Date</dt>
                  <dd className="text-sm font-semibold text-slate-900">{formatReportDate(createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Report Generated</dt>
                  <dd className="text-sm font-semibold text-slate-900">{formatReportDate(generatedAt)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Target</dt>
                <dd className="break-words text-sm font-semibold text-slate-900">{targetUrl}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Scope</dt>
                  <dd className="text-sm font-semibold text-slate-900">{scope}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Profile</dt>
                  <dd className="text-sm font-semibold text-slate-900">{profileLabel}</dd>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Preset</dt>
                  <dd className="text-sm font-semibold text-slate-900">{effectivePreset}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Runtime</dt>
                  <dd className="text-sm font-semibold text-slate-900">{runtime}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Time limit</dt>
                  <dd className="text-sm font-semibold text-slate-900">{timeoutLabel || "—"}</dd>
                </div>
              </div>
              {endedEarly ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-amber-800">Notice</dt>
                  <dd className="mt-1 text-sm text-amber-900">
                    This scan ended early{endedEarlyReason ? ` (${asString(endedEarlyReason)})` : ""}. Results may be
                    incomplete.
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
<div className="rounded-lg border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Executive Snapshot</p>
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="text-[10px] text-slate-500">Overall Risk</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-4xl font-bold" style={{ color: riskTier.color }}>
                  {riskScore ?? "N/A"}
                </p>
                <p className="text-sm font-medium text-slate-500">/ 100</p>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, riskScore ?? 0))}%`, background: riskTier.color }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold" style={{ color: riskTier.color }}>
                {riskTier.label} risk
              </p>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 text-center">
              {SEVERITY_ORDER.map((sev) => (
                <div key={sev} className="rounded border border-slate-200 bg-slate-50 px-1 py-2">
                  <div className="text-[10px] font-semibold" style={{ color: SEVERITY_COLORS[sev] }}>
                    {sev}
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900">{methodology.counts[sev] || 0}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasNotices && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Coverage notice</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {coverage.failed + coverage.skipped > 0
                ? `${coverage.failed + coverage.skipped} of ${coverage.requested || totalFindings} scanner tool(s) did not complete successfully. `
                : ""}
              The absence of Critical/High findings only covers checks that completed successfully — review the
              Assessment Limitations section before drawing conclusions.
            </p>
          </div>
        )}

        <div className="mt-8 text-xs leading-relaxed text-slate-500">
          <p>
            <span className="font-semibold">Disclaimer:</span> This report reflects findings based on the assessed
            scope and time window at the time of execution. Remediation should be validated in your environment before
            deployment.
          </p>
        </div>
      </section>
{/* Executive Summary */}
      <section className="px-10 py-10">
        <SectionTitle eyebrow="Executive Summary" title="Security Overview" />

        <div className="mt-6 rounded-xl bg-slate-900 p-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Security posture</p>
          <p className="mt-2 text-lg font-semibold leading-snug">{posture}</p>

          {primaryConcern && (
            <div className="mt-4 border-t border-slate-700 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Primary concern</p>
              <p className="mt-2 text-sm leading-relaxed">
                <span className="font-bold text-white">
                  {primaryConcern.code} · {primaryConcern.title}
                </span>
                <span className="text-slate-300"> — {summarizeText(primaryConcern.impact, 220)}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <span className="text-slate-400">Recommended next step: </span>
                <span className="text-slate-200">{summarizeText(primaryConcern.remediation, 220)}</span>
              </p>
            </div>
          )}
        </div>

        {hasNotices && (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Assessment coverage was partial — read with care
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              The execution manifest recorded {coverage.requested || 0} requested tool run(s) with {coverage.succeeded}{" "}
              succeeded, {coverage.failed} failed and {coverage.skipped} skipped.
              {partitioned.timeouts.length > 0 ? " The run also hit its time limit, so some tools may not have finished." : ""}{" "}
              Consequently, the statement above applies only to checks that completed successfully. Areas covered by
              failed or skipped tools were not validated in this assessment. See{" "}
              <span className="font-semibold">Assessment Limitations &amp; Scanner Exceptions</span>.
            </p>
          </div>
        )}

        <div className="mt-7 grid grid-cols-3 gap-3">
          <MetricCard label="Total Findings" value={totalFindings} color="#0f172a" bg="#f8fafc" />
          <MetricCard label="Critical" value={methodology.counts.CRITICAL} color={SEVERITY_COLORS.CRITICAL} bg={SEVERITY_BG_COLORS.CRITICAL} />
          <MetricCard label="High" value={methodology.counts.HIGH} color={SEVERITY_COLORS.HIGH} bg={SEVERITY_BG_COLORS.HIGH} />
          <MetricCard label="Medium" value={methodology.counts.MEDIUM} color={SEVERITY_COLORS.MEDIUM} bg={SEVERITY_BG_COLORS.MEDIUM} />
          <MetricCard label="Low" value={methodology.counts.LOW} color={SEVERITY_COLORS.LOW} bg={SEVERITY_BG_COLORS.LOW} />
          <MetricCard label="Informational" value={methodology.counts.INFO} color={SEVERITY_COLORS.INFO} bg={SEVERITY_BG_COLORS.INFO} />
        </div>

        <div className="mt-7 grid grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 p-5 pdf-avoid-break">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Severity distribution</p>
            <div className="mt-4 space-y-3">
              {SEVERITY_ORDER.map((sev) => (
                <SeverityBar
                  key={sev}
                  severity={sev}
                  count={methodology.counts[sev] || 0}
                  maxCount={maxCount}
                  color={SEVERITY_COLORS[sev]}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-5 pdf-avoid-break">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Risk score methodology</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              The overall score is calculated from the severity, count and relative weight of every finding recorded in
              the assessment (including informational and tool-status records), normalized to a 0–100 scale.
            </p>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600">Severity</th>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600">Count</th>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600">Weight</th>
                </tr>
              </thead>
              <tbody>
                {SEVERITY_ORDER.map((sev) => (
                  <tr key={sev}>
                    <td className="border border-slate-200 px-2 py-1.5 text-[11px] font-medium" style={{ color: SEVERITY_COLORS[sev] }}>
                      {sev}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-[11px]">{methodology.counts[sev] || 0}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-[11px]">× {SEVERITY_WEIGHTS[sev]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 pdf-mono">
              {methodology.workedExample}
            </div>
          </div>
        </div>
      </section>
{/* Findings */}
      <section className="px-10 py-10 pdf-break-before">
        <SectionTitle eyebrow="Findings" title="Validated Findings" />

        {securityFindings.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-base font-semibold text-slate-800">No security findings recorded</p>
            <p className="mt-1 text-sm text-slate-500">
              Every tool that completed successfully returned no vulnerability or configuration findings. Review the
              Assessment Limitations section for coverage gaps before drawing conclusions.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">ID</th>
                  <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Finding</th>
                  <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Tool</th>
                  <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Severity</th>
                </tr>
              </thead>
              <tbody>
                {securityFindings.map(({ code, finding }) => (
                  <tr key={finding.id}>
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-500">{code}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-800">
                      {summarizeText(finding.title, 90)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] text-slate-600">{humanizeLabel(finding.toolName)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <SeverityChip severity={finding.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6">
          {securityFindings.map(({ code, finding, evidenceHighlights, reproductionSteps }) => (
            <div key={finding.id} className="pdf-avoid-break rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {code} · {humanizeLabel(finding.toolName)}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">{finding.title}</h3>
                </div>
                <SeverityChip severity={finding.severity} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Summary &amp; impact</p>
                  <p className="mt-1 leading-relaxed text-slate-700">{summarizeText(finding.description, 500)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recommended action</p>
                  <p className="mt-1 leading-relaxed text-slate-700">
                    {summarizeText(finding.remediation, 500) || "Review and remediate in line with operational priorities."}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Evidence observed by the scanner</p>
                {evidenceHighlights.length > 0 ? (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-[12px] leading-relaxed text-slate-700">
                    {evidenceHighlights.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                    No machine-observable evidence was captured for this finding. Manual validation is recommended
                    before treating this item as confirmed — this finding is based on automated scanner analysis.
                  </p>
                )}
              </div>

              {reproductionSteps.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reproduction</p>
                  <ol className="mt-2 list-decimal list-inside space-y-1 text-[12px] leading-relaxed text-slate-700">
                    {reproductionSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {Array.isArray(finding.complianceMapping) && finding.complianceMapping.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {finding.complianceMapping.map((c) => (
                    <span key={c} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* Changes since previous assessment */}
      {scanDiff && scanDiff.hasChanges ? (
        <section className="px-10 py-10 pdf-break-before">
          <SectionTitle eyebrow="Trend" title="Changes Since Previous Assessment" />

          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            Comparison against the previous completed assessment
            {scanDiff.baselineCompletedAt ? ` on ${formatReportDate(scanDiff.baselineCompletedAt)}` : ''}. New
            findings should be triaged with the roadmap; resolved findings confirm earlier remediation has taken
            effect.
          </p>

          <div className="mt-6 grid grid-cols-5 gap-3">
            <MetricCard label="Baseline" value={scanDiff.baselineFindingCount} color="#0f172a" bg="#f8fafc" />
            <MetricCard label="Current" value={scanDiff.currentFindingCount} color="#0f172a" bg="#f8fafc" />
            <MetricCard label="New" value={scanDiff.newFindingCount} color={SEVERITY_COLORS.HIGH} bg={SEVERITY_BG_COLORS.HIGH} />
            <MetricCard label="Resolved" value={scanDiff.resolvedFindingCount} color="#15803d" bg="#dcfce7" />
            <MetricCard label="Unchanged" value={scanDiff.unchangedFindingCount} color={SEVERITY_COLORS.INFO} bg={SEVERITY_BG_COLORS.INFO} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div className="pdf-avoid-break rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                New findings ({scanDiff.newFindings.length})
              </p>
              <ul className="mt-3 space-y-2 text-[12px] leading-relaxed">
                {scanDiff.newFindings.slice(0, 6).map((f, i) => (
                  <li key={`new-${i}`} className="flex items-start gap-2">
                    <SeverityChip severity={f.severity} />
                    <span className="text-slate-700">
                      <span className="font-semibold text-slate-900">{f.title}</span>
                      {f.toolName ? <span className="text-slate-400"> · {humanizeLabel(f.toolName)}</span> : null}
                    </span>
                  </li>
                ))}
                {scanDiff.newFindings.length === 0 && <li className="text-slate-500">No new findings.</li>}
              </ul>
            </div>

            <div className="pdf-avoid-break rounded-xl border border-slate-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Resolved findings ({scanDiff.resolvedFindings.length})
              </p>
              <ul className="mt-3 space-y-2 text-[12px] leading-relaxed">
                {scanDiff.resolvedFindings.slice(0, 6).map((f, i) => (
                  <li key={`resolved-${i}`} className="flex items-start gap-2">
                    <SeverityChip severity={f.severity} />
                    <span className="text-slate-700">
                      <span className="font-semibold text-slate-900">{f.title}</span>
                      {f.toolName ? <span className="text-slate-400"> · {humanizeLabel(f.toolName)}</span> : null}
                    </span>
                  </li>
                ))}
                {scanDiff.resolvedFindings.length === 0 && <li className="text-slate-500">No resolved findings.</li>}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
{/* Assessment Limitations & Scanner Exceptions */}
      <section className="px-10 py-10 pdf-break-before">
        <SectionTitle eyebrow="Coverage" title="Assessment Limitations & Scanner Exceptions" />

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          The items below are <span className="font-semibold">operational and tooling limitations</span>, not security
          findings. They describe checks that failed, were skipped, or were cut short by the run time limit. These
          items do not contribute to the overall risk score, but they do narrow the coverage of this assessment.
        </p>

        {partitioned.timeouts.length > 0 && (
          <div className="pdf-avoid-break mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Run time limit reached</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {partitioned.timeouts.map((f) => summarizeText(f.description, 400)).join(" ")}
            </p>
          </div>
        )}

        {endedEarly && (
          <div className="pdf-avoid-break mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Run ended early</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              This assessment run ended early{endedEarlyReason ? ` (${asString(endedEarlyReason)})` : ""}. Some tools
              may not have completed, so results may be incomplete.
            </p>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Tool</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Status</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Impact on assessment coverage</th>
              </tr>
            </thead>
            <tbody>
              {limitations.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-sm text-slate-500">
                    All requested tools completed successfully. No scanner exceptions were recorded.
                  </td>
                </tr>
              )}
              {limitations.map((lim) => (
                <tr key={`${lim.tool}-${lim.status}`}>
                  <td className="border-b border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-800">
                    {lim.tool}
                    {lim.errorType ? <span className="ml-1.5 font-normal text-slate-400">({lim.errorType})</span> : null}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        lim.status === "Skipped" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {lim.status}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-[12px] leading-relaxed text-slate-700">{lim.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {partitioned.exceptions.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {partitioned.exceptions.map((f) => {
              const ev = asRecord(f.evidence) ?? {};
              return (
                <div key={f.id} className="pdf-avoid-break rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {humanizeLabel(f.toolName)} — {f.title}
                    </p>
                    <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                      Exception
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                    {summarizeText(f.description, 300) || "The tool raised an exception during execution."}
                  </p>
                  {asString(ev.errorType) && (
                    <div className="mt-2 rounded bg-white p-2 text-[11px] text-slate-500 pdf-mono">
                      Error type: {asString(ev.errorType)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
{/* Remediation Roadmap */}
      <section className="px-10 py-10 pdf-break-before">
        <SectionTitle eyebrow="Remediation" title="Remediation Roadmap" />

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          The roadmap below proposes a practical, time-boxed sequence for reducing risk while preserving operational
          stability. It covers only the findings classified as security findings in this report — scanner exceptions
          are handled in the Assessment Limitations section.
        </p>

        <div className="mt-6 space-y-6 text-sm">
          <div className="pdf-avoid-break rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">0–30 Days</h3>
              <div className="flex gap-1.5">
                <SeverityChip severity="CRITICAL" />
                <SeverityChip severity="HIGH" />
              </div>
            </div>
            <ul className="mt-3 list-disc list-inside space-y-2 leading-relaxed text-slate-700">
              {securityFindings
                .filter(({ finding }) => finding.severity === "CRITICAL" || finding.severity === "HIGH")
                .map(({ code, finding }) => (
                  <li key={finding.id}>
                    <span className="font-semibold text-slate-900">{code} {finding.title}:</span>{" "}
                    {summarizeText(finding.remediation, 160)}
                  </li>
                ))}
              {securityFindings.filter(
                ({ finding }) => finding.severity === "CRITICAL" || finding.severity === "HIGH",
              ).length === 0 && <li>No Critical or High findings to remediate.</li>}
            </ul>
          </div>

          <div className="pdf-avoid-break rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">31–60 Days</h3>
              <SeverityChip severity="MEDIUM" />
            </div>
            <ul className="mt-3 list-disc list-inside space-y-2 leading-relaxed text-slate-700">
              {securityFindings
                .filter(({ finding }) => finding.severity === "MEDIUM")
                .map(({ code, finding }) => (
                  <li key={finding.id}>
                    <span className="font-semibold text-slate-900">{code} {finding.title}:</span>{" "}
                    {summarizeText(finding.remediation, 160)}
                  </li>
                ))}
              {securityFindings.filter(({ finding }) => finding.severity === "MEDIUM").length === 0 && (
                <li>No Medium findings to remediate.</li>
              )}
            </ul>
          </div>

          <div className="pdf-avoid-break rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">61–90 Days</h3>
              <div className="flex gap-1.5">
                <SeverityChip severity="LOW" />
                <SeverityChip severity="INFO" />
              </div>
            </div>
            <ul className="mt-3 list-disc list-inside space-y-2 leading-relaxed text-slate-700">
              {securityFindings
                .filter(({ finding }) => finding.severity === "LOW" || finding.severity === "INFO")
                .map(({ code, finding }) => (
                  <li key={finding.id}>
                    <span className="font-semibold text-slate-900">{code} {finding.title}:</span>{" "}
                    {summarizeText(finding.remediation, 160)}
                  </li>
                ))}
              {securityFindings.filter(
                ({ finding }) => finding.severity === "LOW" || finding.severity === "INFO",
              ).length === 0 && <li>No Low or Informational findings to remediate.</li>}
            </ul>
          </div>
        </div>
      </section>
{/* Appendix: Detailed Findings (raw JSON for technical readers) */}
      <section className="px-10 py-10 pdf-break-before">
        <SectionTitle eyebrow="Technical Appendix" title="Detailed Findings & Raw Evidence" />

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          Engine-level evidence captured for each validated security finding. This section is intended for technical
          reviewers and auditors; the executive-facing details are in the Findings section.
        </p>

        <div className="mt-6 space-y-6">
          {securityFindings.map(({ code, finding, reproductionSteps }) => (
            <div key={finding.id} className="pdf-avoid-break rounded-lg border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-slate-400">
                    {code} · {humanizeLabel(finding.toolName)}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{finding.title}</h3>
                </div>
                <SeverityChip severity={finding.severity} />
              </div>

              {Array.isArray(finding.complianceMapping) && finding.complianceMapping.length > 0 && (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold">Compliance:</span> {finding.complianceMapping.join(", ")}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Risk rating</p>
                  <SeverityChip severity={finding.severity} />

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Impact (plain language)
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {summarizeText(finding.description, 400)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reproduction</p>
                  {reproductionSteps.length > 0 ? (
                    <ol className="mt-2 list-decimal list-inside space-y-1 text-sm leading-relaxed text-slate-700">
                      {reproductionSteps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">Not applicable — see evidence data.</p>
                  )}

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Exact fix guidance</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{finding.remediation}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence (raw JSON)</p>
                <pre className="pdf-mono mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                  {JSON.stringify(finding.evidence ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ))}
          {securityFindings.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No security findings to display.
            </div>
          )}
        </div>
      </section>
{/* Appendix: Tool Execution Manifest & Scanner Metadata */}
      <section className="px-10 py-10 pdf-break-before">
        <SectionTitle eyebrow="Technical Appendix" title="Tool Execution Manifest & Scanner Metadata" />

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Tool</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Status</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Findings</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Duration</th>
              </tr>
            </thead>
            <tbody>
              {toolRuns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-sm text-slate-500">
                    No execution manifest captured for this assessment.
                  </td>
                </tr>
              )}
              {toolRuns.map((run, idx) => {
                const status = asString(run.status).toLowerCase();
                const ok = status === "ok";
                return (
                  <tr key={`${asString(run.name)}-${idx}`}>
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-800">
                      {humanizeLabel(run.name)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] text-slate-700">
                      {typeof run.findings === "number" ? (run.findings as number) : "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] text-slate-700">
                      {typeof run.durationMs === "number" ? `${Math.round((run.durationMs as number) / 1000)}s` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Target</dt>
            <dd className="break-words font-semibold text-slate-900">{targetUrl}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Scope</dt>
            <dd className="font-semibold text-slate-900">{scope}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Preset</dt>
            <dd className="font-semibold text-slate-900">{effectivePreset}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Runtime</dt>
            <dd className="font-semibold text-slate-900">{runtime}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Time limit</dt>
            <dd className="font-semibold text-slate-900">{timeoutLabel || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Tools succeeded</dt>
            <dd className="font-semibold text-slate-900">{asString(manifestEvidence?.toolsSucceeded) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Tools failed</dt>
            <dd className="font-semibold text-slate-900">{asString(manifestEvidence?.toolsFailed) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Duration</dt>
            <dd className="font-semibold text-slate-900">
              {typeof manifestEvidence?.durationMs === "number"
                ? `${Math.round((manifestEvidence.durationMs as number) / 1000)}s`
                : "—"}
            </dd>
          </div>
        </dl>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          <p className="font-semibold">Sentinel Stack Security Report • Confidential</p>
          <p className="mt-1">
            This report is intended solely for the designated recipient and may contain confidential information.
          </p>
        </footer>
      </section>
    </div>
  );
}