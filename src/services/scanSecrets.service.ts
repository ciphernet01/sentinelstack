import crypto from 'crypto';

export type SensitiveScanOptions = {
  cookies?: string;
  headers?: Record<string, string>;
  wordlist?: string;
  [key: string]: unknown;
};

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'proxy-authorization',
]);

const getEncryptionKey = (): Buffer => {
  const secret = process.env.SCAN_SECRET_ENCRYPTION_KEY;
  if (!secret || secret.trim().length < 32) {
    throw new Error('SCAN_SECRET_ENCRYPTION_KEY must be set to at least 32 characters before storing scan credentials.');
  }

  return crypto.createHash('sha256').update(secret).digest();
};

const hasValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

export const hasSensitiveScanOptions = (options: SensitiveScanOptions = {}): boolean => {
  return hasValue(options.cookies) || hasValue(options.headers) || hasValue(options.wordlist);
};

export const redactScanOptions = (options: SensitiveScanOptions = {}) => {
  const headerNames = options.headers && typeof options.headers === 'object'
    ? Object.keys(options.headers)
    : [];

  return {
    hasCookies: hasValue(options.cookies),
    hasWordlist: hasValue(options.wordlist),
    headerNames,
    sensitiveHeaderNames: headerNames.filter((name) => SENSITIVE_HEADER_NAMES.has(name.toLowerCase())),
    additionalOptionKeys: Object.keys(options).filter((key) => !['cookies', 'headers', 'wordlist'].includes(key)),
  };
};

export const encryptScanOptions = (options: SensitiveScanOptions = {}): string | undefined => {
  if (!hasSensitiveScanOptions(options)) return undefined;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(options), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
};

export const decryptScanOptions = (payload: unknown): SensitiveScanOptions => {
  if (typeof payload !== 'string' || !payload.trim()) return {};

  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted scan options payload.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]);

  const parsed = JSON.parse(decrypted.toString('utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};
