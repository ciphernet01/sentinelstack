export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogMetadata {
  [key: string]: unknown;
}

export interface JsonLogLine {
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
  metadata: LogMetadata;
}

export interface LogWhispererPayload {
  source: string;
  format_hint: 'json';
  service_override: string;
  lines: string[];
}

export interface LogShipperStats {
  queuedCount: number;
  totalSent: number;
  totalFailed: number;
  totalDropped: number;
  dropWarnings: number;
  lastFlushTime: string | null;
}

export interface LogWhispererConfig {
  enabled: boolean;
  pushUrl: string;
  service: string;
  source: string;
  batchSize: number;
  flushMs: number;
  requestTimeoutMs: number;
  apiKey?: string;
  maxQueueSize: number;
  retryBaseMs: number;
  retryMaxMs: number;
  redactionFields: string[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type WarnLike = (message: string) => void;

const DEFAULT_REDACTION_FIELDS = [
  'password',
  'token',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'cookie',
  'set-cookie',
];

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseIntWithDefault(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function redactValue(value: unknown, redactionFields: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, redactionFields));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (redactionFields.has(key.toLowerCase())) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactValue(nestedValue, redactionFields);
      }
    }
    return output;
  }

  return value;
}

export function buildLogWhispererConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LogWhispererConfig {
  const enabled = parseBool(env.LOG_WHISPERER_ENABLED, true);
  const pushUrl = (env.LOG_WHISPERER_PUSH_URL || '').trim();
  const service = (env.LOG_WHISPERER_SERVICE || 'sentinel-stack').trim() || 'sentinel-stack';
  const source = 'render-webapp';
  const redactionListRaw = (env.LOG_WHISPERER_REDACT_FIELDS || '').trim();
  const redactionFields = redactionListRaw
    ? redactionListRaw
      .split(',')
      .map((field) => field.trim().toLowerCase())
      .filter(Boolean)
    : [...DEFAULT_REDACTION_FIELDS];

  return {
    enabled: enabled && pushUrl.length > 0,
    pushUrl,
    service,
    source,
    batchSize: parseIntWithDefault(env.LOG_WHISPERER_BATCH_SIZE, 50),
    flushMs: parseIntWithDefault(env.LOG_WHISPERER_FLUSH_MS, 2000),
    requestTimeoutMs: parseIntWithDefault(env.LOG_WHISPERER_REQUEST_TIMEOUT_MS, 5000),
    apiKey: env.LOG_WHISPERER_API_KEY,
    maxQueueSize: parseIntWithDefault(env.LOG_WHISPERER_MAX_QUEUE, 5000),
    retryBaseMs: parseIntWithDefault(env.LOG_WHISPERER_RETRY_BASE_MS, 250),
    retryMaxMs: parseIntWithDefault(env.LOG_WHISPERER_RETRY_MAX_MS, 15000),
    redactionFields,
  };
}

interface LogWhispererShipperDependencies {
  fetchImpl?: FetchLike;
  warnImpl?: WarnLike;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  nowImpl?: () => number;
}

export class LogWhispererShipper {
  private readonly config: LogWhispererConfig;
  private readonly fetchImpl: FetchLike;
  private readonly warnImpl: WarnLike;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly setTimeoutImpl: typeof setTimeout;
  private readonly clearTimeoutImpl: typeof clearTimeout;
  private readonly nowImpl: () => number;
  private readonly redactionFieldSet: Set<string>;

  private readonly queue: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private inFlight = false;
  private shuttingDown = false;

  private totalSent = 0;
  private totalFailed = 0;
  private totalDropped = 0;
  private dropWarnings = 0;
  private lastFlushTime: string | null = null;

  constructor(config: LogWhispererConfig, deps: LogWhispererShipperDependencies = {}) {
    this.config = config;
    this.fetchImpl = deps.fetchImpl || (fetch as FetchLike);
    this.warnImpl = deps.warnImpl || ((message) => console.warn(message));
    this.setIntervalImpl = deps.setIntervalImpl || setInterval;
    this.clearIntervalImpl = deps.clearIntervalImpl || clearInterval;
    this.setTimeoutImpl = deps.setTimeoutImpl || setTimeout;
    this.clearTimeoutImpl = deps.clearTimeoutImpl || clearTimeout;
    this.nowImpl = deps.nowImpl || (() => Date.now());
    this.redactionFieldSet = new Set((config.redactionFields || []).map((field) => field.toLowerCase()));

    if (!this.config.enabled && parseBool(process.env.LOG_WHISPERER_ENABLED, true)) {
      this.warnImpl('[log-shipper] Disabled because LOG_WHISPERER_PUSH_URL is missing.');
    }

    this.start();
  }

  info(message: string, metadata: LogMetadata = {}): void {
    this.log('INFO', message, metadata);
  }

  warn(message: string, metadata: LogMetadata = {}): void {
    this.log('WARN', message, metadata);
  }

  error(message: string, metadata: LogMetadata = {}): void {
    this.log('ERROR', message, metadata);
  }

  fatal(message: string, metadata: LogMetadata = {}): void {
    this.log('FATAL', message, metadata);
  }

  log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    if (!this.config.enabled) {
      return;
    }

    const line: JsonLogLine = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      level,
      message,
      metadata: redactValue(metadata, this.redactionFieldSet) as LogMetadata,
    };

    const lineText = JSON.stringify(line);
    if (this.queue.length >= this.config.maxQueueSize) {
      this.queue.shift();
      this.totalDropped += 1;
      this.dropWarnings += 1;
      if (this.dropWarnings === 1 || this.dropWarnings % 50 === 0) {
        this.warnImpl(
          `[log-shipper] Queue full at ${this.config.maxQueueSize}; dropping oldest logs (drops=${this.totalDropped}).`
        );
      }
    }

    this.queue.push(lineText);
    if (this.queue.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  getStats(): LogShipperStats {
    return {
      queuedCount: this.queue.length,
      totalSent: this.totalSent,
      totalFailed: this.totalFailed,
      totalDropped: this.totalDropped,
      dropWarnings: this.dropWarnings,
      lastFlushTime: this.lastFlushTime,
    };
  }

  async flush(): Promise<void> {
    await this.flushInternal(false);
  }

  async shutdown(deadlineMs = 10000): Promise<void> {
    this.shuttingDown = true;

    if (this.flushTimer) {
      this.clearIntervalImpl(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.retryTimer) {
      this.clearTimeoutImpl(this.retryTimer);
      this.retryTimer = null;
    }

    const deadline = this.nowImpl() + deadlineMs;
    while (this.queue.length > 0 && this.nowImpl() < deadline) {
      await this.flushInternal(true);
      if (this.queue.length > 0) {
        await new Promise<void>((resolve) => {
          const timeout = this.setTimeoutImpl(() => resolve(), 100);
          timeout.unref?.();
        });
      }
    }
  }

  private start(): void {
    if (!this.config.enabled) {
      return;
    }

    this.flushTimer = this.setIntervalImpl(() => {
      void this.flush();
    }, this.config.flushMs);
    this.flushTimer.unref?.();
  }

  private async flushInternal(isShutdownFlush: boolean): Promise<void> {
    if (!this.config.enabled || this.inFlight || this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.config.batchSize);
    this.inFlight = true;

    try {
      await this.pushBatch(batch);
      this.totalSent += batch.length;
      this.lastFlushTime = new Date().toISOString();
      this.retryAttempt = 0;
      if (this.queue.length > 0) {
        queueMicrotask(() => {
          void this.flush();
        });
      }
    } catch (error) {
      this.totalFailed += batch.length;
      this.queue.unshift(...batch);
      if (!isShutdownFlush && !this.shuttingDown) {
        this.scheduleRetry();
      }
      this.warnImpl(`[log-shipper] Failed to push logs: ${getErrorMessage(error)}`);
    } finally {
      this.inFlight = false;
    }
  }

  private async pushBatch(lines: string[]): Promise<void> {
    const payload: LogWhispererPayload = {
      source: this.config.source,
      format_hint: 'json',
      service_override: this.config.service,
      lines,
    };

    const abortController = new AbortController();
    const timeout = this.setTimeoutImpl(() => {
      abortController.abort();
    }, this.config.requestTimeoutMs);
    timeout.unref?.();

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    try {
      const response = await this.fetchImpl(this.config.pushUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } finally {
      this.clearTimeoutImpl(timeout);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.queue.length === 0) {
      return;
    }

    const delayMs = Math.min(this.config.retryMaxMs, this.config.retryBaseMs * Math.pow(2, this.retryAttempt));
    this.retryAttempt += 1;

    this.retryTimer = this.setTimeoutImpl(() => {
      this.retryTimer = null;
      void this.flush();
    }, delayMs);
    this.retryTimer.unref?.();
  }
}
