import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { logShipper } from '../logging';
import { isRiskDomainError } from '../services/risk/errors';

/**
 * Detects whether an error originated from the body parser.
 * Express JSON/urlencoded parse failures surface as SyntaxError with a `type`.
 */
const getBodyParserIssue = (err: Error & { type?: string; status?: number; statusCode?: number }) => {
  const type = err?.type || '';
  if (type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Malformed request body: invalid JSON.' };
  }
  if (type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request body too large.' };
  }
  if (type === 'entity.verify.failed') {
    return { statusCode: 400, message: 'Request body verification failed.' };
  }
  return null;
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  const prefix = requestId ? `[${requestId}] ` : '';
  logger.error(`${prefix}${err.stack || String(err)}`);
  logShipper.error('Unhandled request error', {
    method: req.method,
    path: req.originalUrl || req.url,
    request_id: requestId,
    error_message: err.message,
    stack: err.stack,
  });

  // If headers were already sent to the client, we cannot send a JSON error
  // anymore. Delegate to Express's default handler so the socket is closed.
  if (res.headersSent) {
    return next(err);
  }

  const bodyIssue = getBodyParserIssue(err as Error & { type?: string });
  if (bodyIssue) {
    return res.status(bodyIssue.statusCode).json({
      success: false,
      message: bodyIssue.message,
      requestId,
    });
  }

  // Risk-domain failures carry their own status and stable code. Without this
  // branch a "driver not found" or a cross-tenant refusal would surface as an
  // opaque 500 and look like a server fault rather than a deliberate answer.
  if (isRiskDomainError(err)) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      requestId,
    });
  }

  // Default to a 500 server error
  let statusCode = 500;
  let message = 'An unexpected error occurred.';

  res.status(statusCode).json({
    success: false,
    message: message,
    requestId,
    // Avoid leaking stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Catches unmatched routes and returns a JSON 404 (instead of Express's
 * default HTML page) so API consumers always get structured errors.
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    path: req.originalUrl || req.url,
    requestId: (req as any).requestId,
  });
};
