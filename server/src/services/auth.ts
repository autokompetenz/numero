import argon2 from 'argon2';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { User, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { conflict, forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/ids.js';
import { ensureWallets } from './wallet.js';
import { logAudit } from './audit.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  country: string | null;
  phone: string | null;
  preferredCurrency: string;
  status: string;
  createdAt: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    country: user.country,
    phone: user.phone,
    preferredCurrency: user.preferredCurrency,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

function parseDurationSeconds(value: string, fallback: number): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Math.max(1, amount * (multipliers[unit] ?? 1));
}

export function signAccessToken(user: Pick<User, 'id' | 'email' | 'name' | 'role'>): string {
  return jwt.sign(
    { role: user.role, email: user.email, name: user.name },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: parseDurationSeconds(env.ACCESS_TOKEN_TTL, 900),
      issuer: 'numivo',
      audience: 'numivo-api',
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'numivo',
      audience: 'numivo-api',
    });
    if (typeof payload === 'string' || !payload.sub) {
      throw new Error('Payload invalide');
    }
    return payload as AccessTokenPayload;
  } catch {
    throw unauthorized('Session expirée ou invalide.');
  }
}

async function createRefreshToken(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  replacedByTokenHash?: string;
}): Promise<{ token: string; expiresAt: Date; id: string }> {
  const token = randomToken(48);
  const tokenHash = sha256(token);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const record = await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      userId: params.userId,
      tokenHash,
      expiresAt,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
  return { token, expiresAt, id: record.id };
}

async function issueTokens(
  user: User,
  context: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<IssuedTokens> {
  const refresh = await createRefreshToken({
    userId: user.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  return {
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
}

export async function register(params: {
  email: string;
  password: string;
  name: string;
  country?: string;
  phone?: string;
  preferredCurrency?: 'XOF' | 'EUR' | 'USD';
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw conflict('Un compte existe déjà avec cette adresse e-mail.');
  }

  const passwordHash = await argon2.hash(params.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: params.name.trim(),
        country: params.country ?? null,
        phone: params.phone ?? null,
        preferredCurrency: params.preferredCurrency ?? 'XOF',
      },
    });
    for (const currency of ['XOF', 'EUR', 'USD'] as const) {
      await tx.wallet.create({
        data: { userId: created.id, currency, balanceMinor: 0n },
      });
    }
    return created;
  });

  await logAudit({
    actorId: user.id,
    action: 'auth.register',
    entityType: 'User',
    entityId: user.id,
    ipAddress: params.ipAddress,
  });

  const tokens = await issueTokens(user, params);
  return { user: toPublicUser(user), tokens };
}

export async function login(params: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized('E-mail ou mot de passe incorrect.');

  const valid = await argon2.verify(user.passwordHash, params.password);
  if (!valid) throw unauthorized('E-mail ou mot de passe incorrect.');
  if (user.status !== 'ACTIVE') throw forbidden('Ce compte est suspendu.');

  await ensureWallets(user.id);
  const tokens = await issueTokens(user, params);
  await logAudit({
    actorId: user.id,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    ipAddress: params.ipAddress,
  });

  return { user: toPublicUser(user), tokens };
}

export async function refreshSession(params: {
  refreshToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const tokenHash = sha256(params.refreshToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('Session expirée. Veuillez vous reconnecter.');
  }
  if (record.user.status !== 'ACTIVE') throw forbidden('Ce compte est suspendu.');

  const next = await createRefreshToken({
    userId: record.userId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    replacedByTokenHash: sha256(params.refreshToken),
  });

  const nextHash = sha256(next.token);
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedByTokenHash: nextHash },
  });

  return {
    user: toPublicUser(record.user),
    tokens: {
      accessToken: signAccessToken(record.user),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    } satisfies IssuedTokens,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw unauthorized('Utilisateur introuvable.');
  return user;
}

export async function updateProfile(
  userId: string,
  data: {
    name?: string;
    country?: string;
    phone?: string;
    preferredCurrency?: 'XOF' | 'EUR' | 'USD';
  },
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.preferredCurrency !== undefined
        ? { preferredCurrency: data.preferredCurrency }
        : {}),
    },
  });
  return toPublicUser(user);
}
