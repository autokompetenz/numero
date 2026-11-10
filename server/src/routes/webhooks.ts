import { Router, Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sha256 } from '../lib/ids.js';
import {
  parseFedaPayEvent,
  processFedaPayTransaction,
} from '../services/payments.js';
import { verifyFedaPayWebhook } from '../providers/fedapay/index.js';
import { syncOrderFromProvider } from '../services/fulfillment.js';

export const webhooksRouter = Router();

function rawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body ?? {});
}

async function claimEvent(params: {
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<{ process: boolean; id: string }> {
  try {
    const event = await prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        eventId: params.eventId,
        eventType: params.eventType,
        payload: params.payload as Prisma.InputJsonValue,
        status: 'RECEIVED',
      },
    });
    return { process: true, id: event.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.webhookEvent.findUnique({
        where: {
          provider_eventId: { provider: params.provider, eventId: params.eventId },
        },
      });
      // Un événement déjà traité est acquitté sans retraitement.
      if (existing && existing.status !== 'FAILED') {
        return { process: false, id: existing.id };
      }
      if (existing) {
        return { process: true, id: existing.id };
      }
    }
    throw error;
  }
}

async function finalizeEvent(
  id: string,
  status: 'PROCESSED' | 'IGNORED' | 'FAILED',
  error?: string,
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id },
    data: { status, processedAt: new Date(), error: error?.slice(0, 1000) },
  });
}

// -----------------------------------------------------------------------------
// FedaPay
// -----------------------------------------------------------------------------
webhooksRouter.post('/fedapay', async (req, res, next) => {
  try {
    if (!env.FEDAPAY_WEBHOOK_SECRET) {
      res.status(503).json({
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'FEDAPAY_WEBHOOK_SECRET n’est pas configuré.',
        },
      });
      return;
    }

    const body = rawBody(req);
    let payload: Record<string, unknown>;
    try {
      payload = verifyFedaPayWebhook(
        body,
        req.headers['x-fedapay-signature'] as string | undefined,
        env.FEDAPAY_WEBHOOK_SECRET,
      ) as Record<string, unknown>;
    } catch (error) {
      logger.warn({ err: error }, 'Webhook FedaPay rejeté');
      res.status(401).json({
        error: { code: 'INVALID_SIGNATURE', message: 'Signature invalide.' },
      });
      return;
    }

    const eventName = String(payload.name ?? payload.type ?? 'transaction.event');
    const eventId =
      payload.id !== undefined
        ? `feda_${String(payload.id)}`
        : `feda_${sha256(body)}`;

    const claim = await claimEvent({
      provider: 'fedapay',
      eventId,
      eventType: eventName,
      payload,
    });
    if (!claim.process) {
      res.json({ received: true, duplicate: true });
      return;
    }

    try {
      const parsed = parseFedaPayEvent(payload);
      if (!parsed.providerTransactionId) {
        await finalizeEvent(claim.id, 'IGNORED', 'Transaction absente');
        res.json({ received: true, ignored: true });
        return;
      }
      const result = await processFedaPayTransaction(
        parsed.providerTransactionId,
        'webhook',
      );
      await finalizeEvent(claim.id, result === 'processed' ? 'PROCESSED' : 'IGNORED');
      res.json({ received: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      await finalizeEvent(claim.id, 'FAILED', message);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// Ultra SMS
// -----------------------------------------------------------------------------
webhooksRouter.post('/ultrasms', async (req, res, next) => {
  try {
    if (!env.ULTRASMS_WEBHOOK_SECRET) {
      res.status(503).json({
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'ULTRASMS_WEBHOOK_SECRET n’est pas configuré.',
        },
      });
      return;
    }

    const body = rawBody(req);
    const timestamp = String(req.headers['x-ultrasms-timestamp'] ?? '');
    const signatureHeader = String(req.headers['x-ultrasms-signature'] ?? '');
    const signature = signatureHeader.replace(/^v1=/, '');

    const timestampNumber = Number(timestamp);
    if (
      !timestamp ||
      !signature ||
      !Number.isFinite(timestampNumber) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300
    ) {
      res.status(401).json({
        error: { code: 'INVALID_SIGNATURE', message: 'Signature invalide ou expirée.' },
      });
      return;
    }

    const expected = createHmac('sha256', env.ULTRASMS_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    const providedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      res.status(401).json({
        error: { code: 'INVALID_SIGNATURE', message: 'Signature invalide.' },
      });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      res.status(400).json({
        error: { code: 'INVALID_PAYLOAD', message: 'Corps JSON invalide.' },
      });
      return;
    }

    const orderPayload = (payload.order ?? payload.data ?? payload) as Record<string, unknown>;
    const providerOrderId = orderPayload?.id ?? payload.order_id;
    const eventType = String(payload.event ?? payload.type ?? 'order.updated');
    const eventId =
      String(req.headers['x-ultrasms-delivery'] ?? '') ||
      (payload.id !== undefined ? `ultra_${String(payload.id)}` : `ultra_${sha256(body)}`);

    const claim = await claimEvent({
      provider: 'ultrasms',
      eventId,
      eventType,
      payload,
    });
    if (!claim.process) {
      res.json({ received: true, duplicate: true });
      return;
    }

    try {
      if (providerOrderId === undefined) {
        await finalizeEvent(claim.id, 'IGNORED', 'Commande absente');
        res.json({ received: true, ignored: true });
        return;
      }
      const order = await prisma.order.findFirst({
        where: { providerOrderId: String(providerOrderId) },
      });
      if (!order) {
        await finalizeEvent(claim.id, 'IGNORED', 'Commande locale introuvable');
        res.json({ received: true, ignored: true });
        return;
      }
      await syncOrderFromProvider(order.id);
      await finalizeEvent(claim.id, 'PROCESSED');
      res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      await finalizeEvent(claim.id, 'FAILED', message);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});
