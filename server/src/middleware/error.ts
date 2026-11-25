import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

const hasProp = <K extends string>(err: unknown, key: K): err is Record<K, unknown> =>
  typeof err === 'object' && err !== null && key in err;

// Express identifies error handlers by their four parameters.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(err.errors)[0]?.message ?? 'Validation failed' });
  }
  if (hasProp(err, 'code') && err.code === 11000) {
    return res.status(409).json({ error: 'That value is already taken' });
  }
  if (hasProp(err, 'type') && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong' });
}
