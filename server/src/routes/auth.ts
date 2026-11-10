import { Router } from 'express';
import { z } from 'zod';
import { authLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  login,
  refreshSession,
  register,
  revokeRefreshToken,
  toPublicUser,
  updateProfile,
} from '../services/auth.js';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from '../lib/cookies.js';
import { unauthorized } from '../lib/errors.js';

export const authRouter = Router();

const context = (req: { ip?: string; headers: Record<string, unknown> }) => ({
  ipAddress: req.ip ?? null,
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
});

const registerSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(128, 'Mot de passe trop long.'),
  name: z.string().trim().min(2, 'Nom trop court.').max(80, 'Nom trop long.'),
  country: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  preferredCurrency: z.enum(['XOF', 'EUR', 'USD']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  country: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  preferredCurrency: z.enum(['XOF', 'EUR', 'USD']).optional(),
});

authRouter.post('/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await register({ ...req.body, ...context(req) });
    setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
    res.status(201).json({
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await login({ ...req.body, ...context(req) });
    setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const token =
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
    if (!token) throw unauthorized('Session absente.');
    const result = await refreshSession({ refreshToken: token, ...context(req) });
    setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token =
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
    if (token) await revokeRefreshToken(token);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

authRouter.patch('/me', requireAuth, validateBody(profileSchema), async (req, res, next) => {
  try {
    const user = await updateProfile(req.user!.id, req.body);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});
