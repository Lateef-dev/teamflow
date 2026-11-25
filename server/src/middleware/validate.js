import { badRequest } from '../lib/httpError.js';

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest(details[0]?.message ?? 'Invalid request', details);
  }
  req.body = result.data;
  next();
};
