import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../services/auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Jeton d’accès manquant.');
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw unauthorized('Compte introuvable.');
    if (user.status !== 'ACTIVE') throw forbidden('Ce compte est suspendu.');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Array<User['role']>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('Privilèges insuffisants.'));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  void (async () => {
    try {
      const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user && user.status === 'ACTIVE') req.user = user;
      next();
    } catch {
      next();
    }
  })();
}
