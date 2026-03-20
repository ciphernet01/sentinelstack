export const DEFAULT_SCANNER_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_SCANNER_STUCK_WARN_MS = 5 * 60 * 1000;
export const DEFAULT_SCANNER_TOOL_STUCK_WARN_MS = 15 * 60 * 1000;
export const DEFAULT_SCANNER_WATCHDOG_INTERVAL_MS = 30 * 1000;

function normalizeKey(value: unknown): string {
	return String(value || '').trim().toLowerCase();
}

/**
 * Default timeout depends on workload.
 * Keep the global default conservative, but give deeper presets/scope more time.
 * Environment variable SCANNER_TIMEOUT_MS still overrides this.
 */
export function getDefaultScannerTimeoutMs(preset: unknown, scope: unknown): number {
	const normalizedPreset = normalizeKey(preset);
	const normalizedScope = normalizeKey(scope);

	const candidates: number[] = [DEFAULT_SCANNER_TIMEOUT_MS];

	// FULL scope typically runs more tools / wider coverage.
	if (normalizedScope === 'full') {
		candidates.push(20 * 60 * 1000);
	}

	// Enterprise preset is expected to be the deepest/slowest.
	if (normalizedPreset === 'enterprise') {
		candidates.push(50 * 60 * 1000);
	}

	return Math.max(...candidates);
}
