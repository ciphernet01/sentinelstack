// Shared pure helpers used by the report renderers (dashboard preview + PDF).
// Everything here must be defensive about evidence shapes coming from the
// Python scanner engine — evidence is sometimes malformed (arrays where objects
// are expected, empty record sets, etc.).

import type { Finding, Severity } from '@prisma/client';

export type SeverityKey = Severity;

export const SEVERITY_ORDER: SeverityKey[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export const SEVERITY_WEIGHTS: Record<SeverityKey, number> = {
  CRITICAL: 5,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

export const SEVERITY_COLORS: Record<SeverityKey, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#2563eb',
  INFO: '#64748b',
};

export const SEVERITY_BG_COLORS: Record<SeverityKey, string> = {
  CRITICAL: '#fee2e2',
  HIGH: '#ffedd5',
  MEDIUM: '#fef9c3',
  LOW: '#dbeafe',
  INFO: '#f1f5f9',
};

type ResultLike = {
  id?: unknown;
  toolName?: unknown;
  title?: unknown;
  severity?: unknown;
  description?: unknown;
  remediation?: unknown;
  evidence?: unknown;
  complianceMapping?: unknown;
};

// ---------------------------------------------------------------------------
// Small coercion helpers
// ---------------------------------------------------------------------------

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) return null;
  return value;
}

export function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function humanizeLabel(value: unknown): string {
  const raw = asString(value).replace(/[_-]+/g, ' ').trim();
  if (!raw) return raw;
  return raw
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function formatReportDate(date: Date | string | number | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function getRiskTier(score: number | null): { label: string; color: string; bg: string } {
  if (score === null) return { label: 'Not Scored', color: '#475569', bg: '#f1f5f9' };
  if (score > 80) return { label: 'Critical', color: '#b91c1c', bg: '#fee2e2' };
  if (score > 60) return { label: 'High', color: '#c2410c', bg: '#ffedd5' };
  if (score > 40) return { label: 'Medium', color: '#a16207', bg: '#fef9c3' };
  return { label: 'Low', color: '#15803d', bg: '#dcfce7' };
}
// ---------------------------------------------------------------------------
// Finding classification
// ---------------------------------------------------------------------------

export function isManifestFinding(finding: ResultLike): boolean {
  const tool = asString(finding?.toolName).trim().toLowerCase();
  const title = asString(finding?.title).toLowerCase();
  return tool === 'scanner' && title.includes('execution manifest');
}

export function isScannerTimeoutFinding(finding: ResultLike): boolean {
  const tool = asString(finding?.toolName).trim().toLowerCase();
  if (tool !== 'scanner') return false;
  const title = asString(finding?.title).toLowerCase();
  return title.includes('time limit') || title.includes('timed out');
}

/** Findings that represent scanner engine exceptions (tool crashes), not security findings. */
export function isScannerExceptionFinding(finding: ResultLike): boolean {
  if (isManifestFinding(finding) || isScannerTimeoutFinding(finding)) return false;
  const title = asString(finding?.title);
  if (/^tool execution failed:/i.test(title)) return true;
  if (/tool returned a non-standard finding/i.test(title)) return true;
  const ev = asRecord(finding?.evidence);
  if (!ev) return false;
  return typeof ev.errorType !== 'undefined' || typeof ev.traceback !== 'undefined';
}

export type PartitionedFindings = {
  manifest: Finding[];
  timeouts: Finding[];
  exceptions: Finding[];
  security: Finding[];
};

export function partitionFindings(findings: Finding[]): PartitionedFindings {
  const sorted = [...(findings || [])].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return asString(a.title).localeCompare(asString(b.title));
  });

  const manifest = sorted.filter(isManifestFinding);
  const timeouts = sorted.filter(isScannerTimeoutFinding);
  const exceptions = sorted.filter(isScannerExceptionFinding);
  const security = sorted.filter(
    (f) => !isManifestFinding(f) && !isScannerTimeoutFinding(f) && !isScannerExceptionFinding(f),
  );

  return { manifest, timeouts, exceptions, security };
}
// ---------------------------------------------------------------------------
// Coverage / limitations
// ---------------------------------------------------------------------------

export type ToolLimitation = {
  tool: string;
  status: string; // Failed | Skipped
  impact: string;
  errorType?: string;
  findingsCount?: number;
  durationMs?: number;
};

export type CoverageSummary = {
  requested: number;
  succeeded: number;
  failed: number;
  skipped: number;
  hasIssues: boolean;
};

export function getManifestEvidence(findings: Finding[]): Record<string, unknown> | null {
  const manifest = (findings || []).find(isManifestFinding);
  return manifest ? asRecord(manifest?.evidence) : null;
}

export function getToolRuns(findings: Finding[]): Array<Record<string, unknown>> {
  const ev = getManifestEvidence(findings);
  const runs = ev ? asArray(ev.toolRuns) : null;
  if (!runs) return [];
  return runs.filter((r): r is Record<string, unknown> => Boolean(asRecord(r)));
}

export function getCoverageSummary(findings: Finding[]): CoverageSummary {
  const runs = getToolRuns(findings);
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const run of runs) {
    const status = asString(run.status).trim().toLowerCase();
    if (status === 'ok') succeeded += 1;
    else if (status === 'skipped') skipped += 1;
    else failed += 1;
  }
  return {
    requested: runs.length,
    succeeded,
    failed,
    skipped,
    hasIssues: failed > 0 || skipped > 0,
  };
}

export function describeToolImpact(toolNameRaw: string): string {
  const tool = asString(toolNameRaw).toLowerCase();
  if (/sql/.test(tool)) return 'SQL injection testing could not be fully validated.';
  if (/xss|reflected|script.*injection|injection.*script/i.test(tool))
    return 'Cross-site scripting (XSS) testing could not be fully validated.';
  if (/secret|credential|api[_-]?key|token/.test(tool))
    return 'Secret/credential exposure detection could not be fully validated.';
  if (/header|ssl|tls|certificate|cipher/.test(tool))
    return 'HTTP header and TLS/SSL configuration checks could not be fully validated.';
  if (/log/.test(tool)) return 'Log analysis checks were not executed; log-based risks could not be assessed.';
  if (/threat|intel/.test(tool)) return 'Threat intelligence correlation checks were not executed.';
  if (/auth|session/.test(tool)) return 'Authentication/session checks could not be fully validated.';
  return `${humanizeLabel(toolNameRaw)} checks could not be fully validated.`;
}
/** Builds the Assessment Limitations & Scanner Exceptions table rows. */
export function getToolLimitations(findings: Finding[]): ToolLimitation[] {
  const seen = new Set<string>();
  const rows: ToolLimitation[] = [];
  const runs = getToolRuns(findings);

  for (const run of runs) {
    const status = asString(run.status).trim().toLowerCase();
    if (status === 'ok') continue;
    const tool = humanizeLabel(asString(run.name) || 'Unknown tool');
    if (seen.has(tool)) continue;
    seen.add(tool);
    rows.push({
      tool,
      status: status === 'skipped' ? 'Skipped' : 'Failed',
      impact: describeToolImpact(tool),
      errorType: asString(run.errorType) || undefined,
      findingsCount: typeof run.findings === 'number' ? (run.findings as number) : undefined,
      durationMs: typeof run.durationMs === 'number' ? (run.durationMs as number) : undefined,
    });
  }

  // Exception findings that are not represented in the manifest toolRuns.
  for (const f of findings || []) {
    if (!isScannerExceptionFinding(f)) continue;
    const tool = humanizeLabel(f.toolName);
    if (seen.has(tool)) continue;
    seen.add(tool);
    rows.push({
      tool,
      status: 'Failed',
      impact: describeToolImpact(tool),
      errorType: asString(asRecord(f.evidence)?.errorType) || undefined,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Risk score methodology
// ---------------------------------------------------------------------------

export type RiskMethodology = {
  counts: Record<SeverityKey, number>;
  total: number;
  weightedSum: number;
  maxScore: number;
  score: number;
  workedExample: string;
};

export function getRiskMethodology(findings: Finding[]): RiskMethodology {
  const counts: Record<SeverityKey, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const f of findings || []) {
    const s = f.severity as SeverityKey;
    if (s in counts) counts[s] += 1;
    else counts.INFO += 1;
  }
  const total = (findings || []).length;
  const weightedSum =
    counts.CRITICAL * SEVERITY_WEIGHTS.CRITICAL +
    counts.HIGH * SEVERITY_WEIGHTS.HIGH +
    counts.MEDIUM * SEVERITY_WEIGHTS.MEDIUM +
    counts.LOW * SEVERITY_WEIGHTS.LOW +
    counts.INFO * SEVERITY_WEIGHTS.INFO;
  const maxScore = total * SEVERITY_WEIGHTS.CRITICAL;
  const score = total === 0 ? 0 : Math.min(100, Math.round((weightedSum / maxScore) * 100));
  const workedExample = `(${counts.CRITICAL}×5 + ${counts.HIGH}×3 + ${counts.MEDIUM}×2 + ${counts.LOW}×1 + ${counts.INFO}×0) ÷ (5 × ${total}) × 100 = ${weightedSum} ÷ ${maxScore} × 100 = ${score}/100`;

  return { counts, total, weightedSum, maxScore, score, workedExample };
}
// ---------------------------------------------------------------------------
// Evidence presentation
// ---------------------------------------------------------------------------

function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'boolean') return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** True when the evidence holds at least one meaningful value for the reader. */
export function hasConcreteEvidence(evidence: unknown): boolean {
  const rec = asRecord(evidence);
  if (!rec) return Array.isArray(evidence) ? (evidence as unknown[]).length > 0 : false;
  return Object.values(rec).some((v) => !isBlankValue(v));
}

const HIGHLIGHT_LABELS: Array<[string, string]> = [
  ['endpoint', 'Affected resource'],
  ['url', 'Affected URL'],
  ['testedUrl', 'Affected URL'],
  ['path', 'Affected path'],
  ['method', 'Method'],
  ['httpMethod', 'Method'],
  ['status', 'HTTP status'],
  ['statusCode', 'HTTP status'],
  ['observed', 'Observed'],
  ['detail', 'Detail'],
  ['reason', 'Reason'],
  ['message', 'Message'],
];

const LIST_HIGHLIGHT_LABELS: Array<[string, string]> = [
  ['missingHeaders', 'Missing security headers'],
  ['missingSecurityHeaders', 'Missing security headers'],
  ['securityHeadersMissing', 'Missing security headers'],
  ['headersMissing', 'Missing security headers'],
  ['vulnerabilities', 'Observed vulnerabilities'],
  ['issues', 'Observed issues'],
  ['weaknesses', 'Weaknesses'],
];

// Fields too noisy/technical for the main report body.
const SKIP_HIGHLIGHT_KEYS = new Set([
  'traceback',
  'raw',
  'toolRuns',
  'metadata',
  'request',
  'response',
  'headers',
  'cookies',
  'rawEvidence',
  'scanOptions',
]);

/** Produces concise, honest "what was observed" bullets for a finding. */
export function extractEvidenceHighlights(finding: ResultLike): string[] {
  const ev = finding?.evidence;
  if (!hasConcreteEvidence(ev)) return [];
  const rec = asRecord(ev);
  if (!rec) {
    const arr = asArray(ev);
    if (arr) return [`${arr.length} item(s) captured by the scanner (see appendix for details).`];
    return [];
  }

  const bullets: string[] = [];

  for (const [key, label] of HIGHLIGHT_LABELS) {
    if (bullets.length >= 5) break;
    const val = rec[key];
    if (val === undefined || isBlankValue(val)) continue;
    const str = asString(val).trim();
    if (str) bullets.push(`${label}: ${str}`);
  }

  for (const [key, label] of LIST_HIGHLIGHT_LABELS) {
    if (bullets.length >= 5) break;
    const arr = asArray(rec[key]);
    if (!arr || arr.length === 0) continue;
    const items = arr.slice(0, 3).map((v) => asString(v)).filter(Boolean);
    if (items.length === 0) continue;
    bullets.push(`${label}: ${items.join(', ')}${arr.length > 3 ? ' …' : ''}`);
  }

  // A small set of scalar/boolean observations worth surfacing.
  const flagObs = [
    ['sessionFixationDetected', 'Session fixation was detected'],
    ['sessionReuseAfterLogout', 'Session reuse after logout was observed'],
    ['httponly', 'HttpOnly cookie attribute was not set'],
    ['secureFlag', 'Secure cookie attribute was not set'],
  ] as Array<[string, string]>;
  for (const [key, text] of flagObs) {
    if (bullets.length >= 5) break;
    if (rec[key] === true) bullets.push(text);
  }

  // Remaining meaningful scalars (up to the budget) — avoids dumping raw JSON.
  const budget = Math.max(0, 5 - bullets.length);
  if (budget > 0) {
    for (const [key, val] of Object.entries(rec)) {
      if (bullets.length >= 5) break;
      if (SKIP_HIGHLIGHT_KEYS.has(key)) continue;
      if (HIGHLIGHT_LABELS.some(([k]) => k === key)) continue;
      if (LIST_HIGHLIGHT_LABELS.some(([k]) => k === key)) continue;
      if (isBlankValue(val) || typeof val === 'object') continue;
      const str = asString(val).trim();
      if (str && str.length <= 80) bullets.push(`${humanizeLabel(key)}: ${str}`);
    }
  }

  return bullets.slice(0, 5);
}

/** Reproduction steps are only produced when the evidence is concrete. */
export function composeReproductionSteps(evidence: unknown, targetUrl: string): string[] {
  const ev = asRecord(evidence);
  if (!ev || !hasConcreteEvidence(evidence)) return [];

  const steps: string[] = [];
  const endpoint = asString(ev.endpoint || ev.path || ev.url || ev.testedUrl).trim();
  const method = asString(ev.method || ev.httpMethod).trim().toUpperCase();

  if (endpoint) {
    const fullUrl = /^https?:\/\//i.test(endpoint)
      ? endpoint
      : `${targetUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    steps.push(`Open ${fullUrl}${method ? ` (${method})` : ''} in a browser or HTTP client.`);
  }

  const request = asRecord(ev.request);
  if (request && asString(request.url)) {
    steps.push(
      `Send a request to ${asString(request.url)}${asString(request.method) ? ` (${asString(request.method).toUpperCase()})` : ''}.`,
    );
  }

  const embedded = asArray(ev.steps);
  if (embedded) {
    for (const s of embedded) {
      if (steps.length >= 4) break;
      const text = asString(s).trim();
      if (text) steps.push(text);
    }
  }

  return steps.slice(0, 4);
}
export type FindingWithEvidenceHints = {
  finding: Finding;
  code: string;
  evidenceHighlights: string[];
  reproductionSteps: string[];
};

export function prepareSecurityFindings(
  findings: Finding[],
  targetUrl: string,
): FindingWithEvidenceHints[] {
  return partitionFindings(findings).security.map((finding, idx) => ({
    finding,
    code: `F-${String(idx + 1).padStart(3, '0')}`,
    evidenceHighlights: extractEvidenceHighlights(finding),
    reproductionSteps: composeReproductionSteps(finding.evidence, targetUrl),
  }));
}

export type PrimaryConcern = {
  code: string;
  title: string;
  severity: SeverityKey;
  impact: string;
  remediation: string;
};

/** The single most important actionable concern for the executive summary. */
export function getPrimaryConcern(findings: Finding[]): PrimaryConcern | null {
  const security = partitionFindings(findings).security;
  if (security.length === 0) return null;

  const ranked = [...security].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const pick = ranked[0];
  const idx = security.indexOf(pick);

  return {
    code: `F-${String(idx + 1).padStart(3, '0')}`,
    title: asString(pick.title),
    severity: pick.severity as SeverityKey,
    impact: asString(pick.description),
    remediation: asString(pick.remediation),
  };
}

/** Statement used by the executive summary. */
export function securityPostureStatement(counts: Record<SeverityKey, number>): string {
  if ((counts.CRITICAL || 0) + (counts.HIGH || 0) === 0) {
    return 'No Critical or High severity findings were identified by the checks that completed successfully.';
  }
  if ((counts.CRITICAL || 0) > 0) {
    return `${counts.CRITICAL} Critical and ${counts.HIGH || 0} High severity findings were identified. Prioritize remediation immediately.`;
  }
  return `${counts.HIGH || 0} High severity findings were identified. Prioritize remediation in the short term.`;
}
// ---------------------------------------------------------------------------
// White-label branding
// ---------------------------------------------------------------------------

export type ReportBrandingInput = {
  companyName?: string | null;
  logoUrl?: string | null;
  reportLogoUrl?: string | null;
  reportHeaderText?: string | null;
  reportFooterText?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  hidePoweredBy?: boolean | null;
} | null | undefined;

export type ResolvedBranding = {
  clientName: string | null;
  logoSrc: string | null;
  headerText: string;
  footerText: string;
  accent: string;
  accentSoft: string;
  accentGradient: string;
  preparedBy: string;
  hidePoweredBy: boolean;
};

const HEX_COLOR_RE = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function normalizeHex(hex: string): string {
  const raw = hex.trim();
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
}

/** Darkens a hex color by the given factor (0-1). */
export function shadeHex(hex: string, factor: number): string {
  if (!HEX_COLOR_RE.test(hex)) return hex;
  const normalized = normalizeHex(hex).slice(1);
  const num = parseInt(normalized, 16);
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function resolveBranding(
  branding: ReportBrandingInput,
  organizationName?: string | null,
): ResolvedBranding {
  const b = branding ?? {};
  const accent =
    typeof b.primaryColor === 'string' && HEX_COLOR_RE.test(b.primaryColor)
      ? normalizeHex(b.primaryColor)
      : '#4f46e5';
  const logoSrc = asString(b.reportLogoUrl || b.logoUrl).trim() || null;
  const clientName = asString(b.companyName || organizationName).trim() || null;
  const hidePoweredBy = b.hidePoweredBy === true;
  const headerText = asString(b.reportHeaderText).trim() || 'Security Assessment Report';
  const footerText =
    asString(b.reportFooterText).trim() ||
    (hidePoweredBy
      ? `Prepared by ${clientName || 'the assessment team'}`
      : 'Sentinel Stack Security Report • Confidential');
  const preparedBy = hidePoweredBy ? clientName || 'the assessment team' : 'Sentinel Stack Platform';

  return {
    clientName,
    logoSrc,
    headerText,
    footerText,
    accent,
    accentSoft: `${accent}14`,
    accentGradient: `linear-gradient(135deg, ${accent}, ${shadeHex(accent, 0.55)})`,
    preparedBy,
    hidePoweredBy,
  };
}

// ---------------------------------------------------------------------------
// Scan diff (changes since previous assessment)
// ---------------------------------------------------------------------------

export type ScanDiffFindingSummary = {
  toolName: string;
  title: string;
  severity: SeverityKey;
  description?: string;
};

export type ResolvedScanDiff = {
  baselineCompletedAt: string | null;
  baselineFindingCount: number;
  currentFindingCount: number;
  newFindingCount: number;
  resolvedFindingCount: number;
  unchangedFindingCount: number;
  newFindings: ScanDiffFindingSummary[];
  resolvedFindings: ScanDiffFindingSummary[];
  hasChanges: boolean;
};

function coerceScanDiffList(value: unknown): ScanDiffFindingSummary[] {
  const arr = asArray(value);
  if (!arr) return [];
  return arr
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const severity = asString(rec.severity).trim().toUpperCase();
      return {
        toolName: asString(rec.toolName),
        title: asString(rec.title),
        severity: (SEVERITY_ORDER.includes(severity as SeverityKey) ? severity : 'INFO') as SeverityKey,
        description: asString(rec.description) || undefined,
      } as ScanDiffFindingSummary;
    })
    .filter((x): x is ScanDiffFindingSummary => x !== null);
}

export function resolveScanDiff(raw: unknown): ResolvedScanDiff | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  const newFindings = coerceScanDiffList(rec.newFindings);
  const resolvedFindings = coerceScanDiffList(rec.resolvedFindings);
  const newCount = num(rec.newFindingCount);
  const resolvedCount = num(rec.resolvedFindingCount);
  return {
    baselineCompletedAt: asString(rec.baselineCompletedAt).trim() || null,
    baselineFindingCount: num(rec.baselineFindingCount),
    currentFindingCount: num(rec.currentFindingCount),
    newFindingCount: newCount,
    resolvedFindingCount: resolvedCount,
    unchangedFindingCount: num(rec.unchangedFindingCount),
    newFindings,
    resolvedFindings,
    hasChanges: newCount > 0 || resolvedCount > 0,
  };
}