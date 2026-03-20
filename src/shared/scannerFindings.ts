export type FindingLike = {
  toolName?: unknown;
  title?: unknown;
  evidence?: unknown;
};

function coerceString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function isScannerTool(toolName: unknown): boolean {
  return coerceString(toolName).trim().toLowerCase() === 'scanner';
}

export function isScannerTimeoutTitle(title: unknown): boolean {
  const t = coerceString(title).toLowerCase();
  return t.includes('timed out') || t.includes('time limit');
}

export function coerceJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function hasLegacyTimeoutEvidence(evidence: unknown): boolean {
  const obj = coerceJsonObject(evidence);
  if (!obj) return false;
  const hasTimeoutMs = typeof obj.timeoutMs !== 'undefined';
  const hasTimeoutSource = typeof obj.timeoutSource !== 'undefined';
  return hasTimeoutMs && !hasTimeoutSource;
}

export function isScannerTimeoutFinding(finding: FindingLike): boolean {
  return isScannerTool(finding?.toolName) && isScannerTimeoutTitle(finding?.title);
}
