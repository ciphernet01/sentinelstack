import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const HEADER_NAME = 'x-internal-secret';

/**
 * Timing-attack-safe comparison of the internal secret.
 * Plain string `!==` compares byte-by-byte and leaks timing information;
 * using crypto.timingSafeEqual removes that side-channel.
 */
const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.PDF_RENDER_SECRET;
  if (!expected) {
    return res.status(500).json({ message: 'Server misconfigured: PDF_RENDER_SECRET is not set.' });
  }

  const provided = req.headers[HEADER_NAME] as string | string[] | undefined;
  const value = Array.isArray(provided) ? provided[0] : provided;

  if (!value || !safeEqual(value, expected)) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  next();
};
