import {
  DEFAULT_SCANNER_TIMEOUT_MS,
  DEFAULT_SCANNER_STUCK_WARN_MS,
  DEFAULT_SCANNER_TOOL_STUCK_WARN_MS,
  DEFAULT_SCANNER_WATCHDOG_INTERVAL_MS,
  getDefaultScannerTimeoutMs,
} from '../shared/scannerDefaults';

export { isScannerTimeoutFinding } from '../shared/scannerFindings';

export type EffectiveScannerConfig = {
  runtime: string;
  preset: string;
  scope: string;
  timeoutMs: number;
  timeoutSource: 'SCANNER_TIMEOUT_MS' | 'default';
  stuckWarnMs: number;
  toolStuckWarnMs: number;
  killOnStuck: boolean;
  watchdogIntervalMs: number;
};

export function getEffectiveScannerConfig(preset: string, scope: string): EffectiveScannerConfig {
  const runtime = String(process.env.SCANNER_RUNTIME || 'local').toLowerCase();

  const timeoutEnvRaw = process.env.SCANNER_TIMEOUT_MS;
  const computedDefaultTimeoutMs = getDefaultScannerTimeoutMs(preset, scope);
  const timeoutMs = Number(timeoutEnvRaw || computedDefaultTimeoutMs || DEFAULT_SCANNER_TIMEOUT_MS);
  const timeoutSource: EffectiveScannerConfig['timeoutSource'] = timeoutEnvRaw ? 'SCANNER_TIMEOUT_MS' : 'default';

  const stuckWarnMs = Number(process.env.SCANNER_STUCK_WARN_MS || DEFAULT_SCANNER_STUCK_WARN_MS);
  const toolStuckWarnMs = Number(process.env.SCANNER_TOOL_STUCK_WARN_MS || DEFAULT_SCANNER_TOOL_STUCK_WARN_MS);
  const killOnStuck = String(process.env.SCANNER_KILL_ON_STUCK || 'false').toLowerCase() === 'true';
  const watchdogIntervalMs = Number(
    process.env.SCANNER_WATCHDOG_INTERVAL_MS || DEFAULT_SCANNER_WATCHDOG_INTERVAL_MS,
  );

  // Normalize preset names to avoid registry warnings.
  const normalizedPreset = String(preset || 'default').trim().toLowerCase();

  return {
    runtime,
    preset: normalizedPreset,
    scope: String(scope || 'WEB'),
    timeoutMs,
    timeoutSource,
    stuckWarnMs,
    toolStuckWarnMs,
    killOnStuck,
    watchdogIntervalMs,
  };
}
