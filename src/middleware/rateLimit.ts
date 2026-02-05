import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth';

function getClientIp(req: Request): string | undefined {
  const anyReq = req as any;
  const xff = anyReq?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim().length > 0) {
    return xff.split(',')[0]?.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0]?.split(',')[0]?.trim();
  }

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
