import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { conflict, unauthorized } from '../lib/httpError.js';
import { config } from '../config.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const exists = await User.exists({ email: req.body.email });
  if (exists) throw conflict('An account with that email already exists');
  const user = await User.create(req.body);
  res.status(201).json({ token: signToken(user._id), user: user.toPublic() });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw unauthorized('Incorrect email or password');
  }
  res.json({ token: signToken(user._id), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
