import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Le client est mémorisé sur `globalThis` dans tous les environnements.
 * Indispensable en serverless (Vercel) pour réutiliser le pool entre invocations.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
