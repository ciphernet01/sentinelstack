import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { logShipper } from '../logging';

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

  // Default to a 500 server error
  let statusCode = 500;
  let message = 'An unexpected error occurred.';

  // You can add custom error types here
  // if (err instanceof CustomError) {
  //   statusCode = err.statusCode;
  //   message = err.message;
  // }
  
  res.status(statusCode).json({
    success: false,
    message: message,
    requestId,
    // Avoid leaking stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
