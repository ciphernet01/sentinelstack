import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth';

function getClientIp(req: Request): string | undefined {
  // Do NOT parse x-forwarded-for manually.
  // Rely on Express's req.ip, which honors app.set('trust proxy', ...)
  // and prevents trivial header spoofing bypasses in our key generator.
  const anyReq = req as any;
  return anyReq?.ip || anyReq?.socket?.remoteAddress || anyReq?.connection?.remoteAddress;
}

function keyByUserOrIp(req: Request): string {
  const r = req as AuthenticatedRequest;
  return r.user?.id || getClientIp(req) || 'unknown';
}

export const authPublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many auth attempts. Please wait and try again.',
    code: 'RATE_LIMITED',
  },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many password reset requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
});

export const scanCreateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: {
    message: 'Too many scan requests in a short time. Please wait and try again.',
    code: 'RATE_LIMITED',
  },
});

export const billingActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: {
    message: 'Too many billing requests. Please wait and try again.',
    code: 'RATE_LIMITED',
  },
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
  },
});

// General API protection: catches endpoints that don't have route-specific limiters.
// Keep it permissive enough for normal dashboard usage.
export const apiGlobalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: (req) => {
    // Webhooks are validated by signature; rate limit them separately.
    const path = String((req as any)?.path || '');
    return path.startsWith('/billing/webhook');
  },
  message: {
    message: 'Too many requests. Please slow down and try again.',
    code: 'RATE_LIMITED',
  },
});

// Protects high-value write operations: webhooks, scheduled scans, org invites.
export const writeOperationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: {
    message: 'Too many creation requests. Please wait before trying again.',
    code: 'RATE_LIMITED',
  },
});
