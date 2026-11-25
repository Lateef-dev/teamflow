import type { Request } from 'express';
import { badRequest } from './httpError.js';

/** A single route parameter as a string (Express types also allow arrays for wildcards). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw badRequest(`Missing route parameter: ${name}`);
  return value;
}
