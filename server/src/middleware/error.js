import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(err.errors)[0]?.message ?? 'Validation failed' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'That value is already taken' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong' });
}
