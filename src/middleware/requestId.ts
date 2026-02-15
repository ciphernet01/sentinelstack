import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Correlates requests across logs/services.
 * - Accepts an incoming X-Request-Id if present.
 * - Otherwise generates a UUID.
 * - Echoes it back in the response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const requestId = (incoming && incoming.trim()) || crypto.randomUUID();

  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
