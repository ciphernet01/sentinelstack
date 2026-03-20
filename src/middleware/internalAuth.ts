import { Request, Response, NextFunction } from 'express';

const HEADER_NAME = 'x-internal-secret';

export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.PDF_RENDER_SECRET;
  if (!expected) {
    return res.status(500).json({ message: 'Server misconfigured: PDF_RENDER_SECRET is not set.' });
  }

  const provided = req.headers[HEADER_NAME] as string | string[] | undefined;
  const value = Array.isArray(provided) ? provided[0] : provided;

  if (!value || value !== expected) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  next();
};
