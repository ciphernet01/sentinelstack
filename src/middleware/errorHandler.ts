import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack);

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
    // Avoid leaking stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
