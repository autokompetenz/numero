import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Le journal d'audit ne doit jamais faire échouer une opération métier.
    logger.error({ err: error, action: input.action }, "Échec d'écriture du journal d'audit");
  }
}
