import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { badRequest } from '../lib/httpError.js';

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export const validate = (schema: z.ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest(details[0]?.message ?? 'Invalid request', details);
  }
  req.body = result.data;
  next();
};

/** Typed access to a body that `validate(schema)` already parsed. */
export const bodyOf = <S extends z.ZodType>(req: Request, _schema: S): z.output<S> => req.body as z.output<S>;
