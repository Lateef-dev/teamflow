import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { config } from '../config.js';
import { User, type UserDoc } from '../models/index.js';
import { unauthorized } from '../lib/httpError.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      /** Socket id of the tab that made the request, so it is not sent its own change back. */
      socketId?: string;
    }
  }
}

export function signToken(userId: Types.ObjectId | string) {
  return jwt.sign({ sub: userId.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function userFromToken(token: unknown): Promise<UserDoc | null> {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) return null;
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await userFromToken(token);
  if (!user) throw unauthorized();
  req.user = user;
  req.socketId = req.get('x-socket-id') || undefined;
  next();
}

/** The signed in user. Only call in handlers mounted after requireAuth. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw unauthorized();
  return req.user;
}
