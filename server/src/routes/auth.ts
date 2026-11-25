import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AuthResponse } from '../../../shared/types.js';
import { User } from '../models/index.js';
import { currentUser, requireAuth, signToken } from '../middleware/auth.js';
import { bodyOf, validate } from '../middleware/validate.js';
import { conflict, unauthorized } from '../lib/httpError.js';
import { toPublicUser } from '../lib/serialize.js';
import { config } from '../config.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const email = z.email('Enter a valid email').transform((e) => e.toLowerCase());

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const body = bodyOf(req, registerSchema);
  if (await User.exists({ email: body.email })) throw conflict('An account with that email already exists');
  const user = await User.create(body);
  const payload: AuthResponse = { token: signToken(user._id), user: toPublicUser(user) };
  res.status(201).json(payload);
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const body = bodyOf(req, loginSchema);
  const user = await User.findOne({ email: body.email }).select('+password');
  if (!user || !(await user.comparePassword(body.password))) {
    throw unauthorized('Incorrect email or password');
  }
  const payload: AuthResponse = { token: signToken(user._id), user: toPublicUser(user) };
  res.json(payload);
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(currentUser(req)) });
});

export default router;
