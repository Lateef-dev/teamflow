import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { unauthorized } from '../lib/httpError.js';

export function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await userFromToken(token);
  if (!user) throw unauthorized();
  req.user = user;
  // The client sends its socket id so we can skip echoing its own changes back to it.
  req.socketId = req.get('x-socket-id') || undefined;
  next();
}
