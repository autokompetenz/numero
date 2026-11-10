import { Currency, Payment, PaymentMethod, PaymentPurpose, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { forbidden, notFound, paymentError } from '../lib/errors.js';
import { newReference } from '../lib/ids.js';
import { getFedaPayClient, FedaPayApiError, FedaPayTransaction } from '../providers/fedapay/index.js';
import { creditWallet } from './wallet.js';
import { scheduleFulfillment } from './fulfillment.js';
import { logAudit } from './audit.js';

const PAID_STATUSES = new Set([
  'approved',
  'transferred',
  'approved_partially_refunded',
  'transferred_partially_refunded',
]);

const FAILED_STATUSES = new Set(['declined', 'canceled', 'cancelled']);

export function serializePayment(
  payment: Payment & {
    order?: { reference: string; status: string } | null;
  },
) {
  return {
    id: payment.id,
    reference: payment.reference,
    purpose: payment.purpose,
    provider: payment.provider,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    amountMinor: Number(payment.amountMinor),
    amount: Number(payment.amountMinor),
    currency: payment.currency,
    checkoutUrl: payment.checkoutUrl,
    providerTransactionId: payment.providerTransactionId,
    orderId: payment.orderId,
    orderReference: payment.order?.reference ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * Crée la transaction FedaPay puis génère le lien de paiement.
 * Le montant est toujours un entier en XOF : FedaPay ne supporte que le XOF.
 */
export async function initializeFedaPayCheckout(paymentId: string): Promise<string> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: { include: { user: true } },
      wallet: { include: { user: true } },
    },
  });
  if (!payment) throw notFound('Paiement introuvable.');
  if (payment.status === 'APPROVED') {
    throw paymentError('Ce paiement est déjà approuvé.');
  }
  if (payment.checkoutUrl) return payment.checkoutUrl;

  const user = payment.order?.user ?? payment.wallet?.user;
  if (!user) throw notFound('Client du paiement introuvable.');

  const amount = Number(payment.amountMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw paymentError('Montant de paiement invalide.');
  }

  const client = getFedaPayClient();
  const callbackBase = `${env.FRONTEND_URL.replace(/\/$/, '')}/`;
  const callbackUrl = `${callbackBase}?payment_ref=${encodeURIComponent(payment.reference)}`;

  try {
    const transaction = await client.createTransaction({
      description: `Numivo ${payment.reference}`.slice(0, 120),
      amount,
      currency: 'XOF',
      callbackUrl,
      customer: {
        firstname: user.name.split(' ')[0] ?? 'Client',
        lastname: user.name.split(' ').slice(1).join(' ') || 'Numivo',
        email: user.email,
      },
    });

    const token = await client.generateToken(transaction.id);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerTransactionId: transaction.id,
        checkoutUrl: token.url,
        metadata: {
          fedapayReference: transaction.reference,
          fedapayStatus: transaction.status,
          token: token.token,
          amount,
          currency: 'XOF',
        },
      },
    });

    if (payment.orderId) {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { checkoutUrl: token.url },
      });
    }

    await logAudit({
      action: 'payment.checkout_created',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        provider: 'FEDAPAY',
        providerTransactionId: transaction.id,
        amount,
        currency: 'XOF',
      },
    });

    return token.url;
  } catch (error) {
    const message =
      error instanceof FedaPayApiError
        ? error.message
        : 'Impossible de créer le lien de paiement.';
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: message },
    });
    logger.error({ err: error, paymentId: payment.id }, 'Échec FedaPay checkout');
    throw paymentError(message);
  }
}

export async function createTopUp(params: {
  userId: string;
  amountMinor: bigint;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
  ipAddress?: string | null;
}) {
  if (params.amountMinor < 500n) {
    throw paymentError('Le montant minimum de recharge est de 500 XOF.');
  }
  if (params.amountMinor > 1_000_000n) {
    throw paymentError('Le montant maximum de recharge est de 1 000 000 XOF.');
  }
  if (params.paymentMethod === 'WALLET') {
    throw paymentError('La recharge par portefeuille est impossible.');
  }

  const idempotencyKey =
    params.idempotencyKey ?? `topup:${params.userId}:${newReference('TOPUP')}`;

  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.walletId) {
      const wallet = await prisma.wallet.findUnique({ where: { id: existing.walletId } });
      if (!wallet || wallet.userId !== params.userId) {
        throw forbidden("Cette clé d'idempotence appartient à un autre compte.");
      }
    }
    return {
      payment: serializePayment(existing),
      checkoutUrl: existing.checkoutUrl ?? (await initializeFedaPayCheckout(existing.id)),
    };
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: params.userId, currency: 'XOF' } },
  });
  if (!wallet) throw notFound('Portefeuille XOF introuvable.');

  const payment = await prisma.payment.create({
    data: {
      purpose: 'TOPUP',
      provider: 'FEDAPAY',
      reference: newReference('RCH'),
      paymentMethod: params.paymentMethod,
      amountMinor: params.amountMinor,
      currency: 'XOF',
      status: 'PENDING',
      idempotencyKey,
      walletId: wallet.id,
      metadata: { ipAddress: params.ipAddress ?? null },
    },
  });

  const checkoutUrl = await initializeFedaPayCheckout(payment.id);
  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  return { payment: serializePayment(updated), checkoutUrl };
}

/**
 * Confirme un paiement de façon idempotente, puis déclenche le fulfillment
 * ou crédite le portefeuille selon l'objet du paiement.
 */
export async function confirmPayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true, wallet: true },
  });
  if (!payment) throw notFound('Paiement introuvable.');

  if (payment.status === 'APPROVED') {
    if (payment.order && payment.order.status === 'PAID') {
      scheduleFulfillment(payment.order.id);
    }
    return;
  }

  if (payment.purpose === 'TOPUP') {
    if (!payment.wallet) throw notFound('Portefeuille cible introuvable.');
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'APPROVED', paidAt: new Date(), failureReason: null },
    });
    await creditWallet({
      userId: payment.wallet.userId,
      currency: payment.currency,
      amountMinor: payment.amountMinor,
      type: 'DEPOSIT',
      description: `Recharge portefeuille ${payment.reference}`,
      idempotencyKey: `topup:${payment.id}`,
      metadata: { paymentId: payment.id, provider: payment.provider },
      referencePrefix: 'DEP',
    });
    await logAudit({
      actorId: payment.wallet.userId,
      action: 'wallet.topup_confirmed',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        amountMinor: payment.amountMinor.toString(),
        currency: payment.currency,
      },
    });
    return;
  }

  const order = payment.order;
  if (!order) throw notFound('Commande associée au paiement introuvable.');

  // Paiement confirmé après expiration/annulation : on encaisse puis on
  // rembourse immédiatement sur le portefeuille pour ne jamais perdre l'argent.
  const wasClosed = ['CANCELLED', 'REFUNDED', 'FAILED'].includes(order.status);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'APPROVED', paidAt: new Date(), failureReason: null },
    });
    if (!wasClosed) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
  });

  await logAudit({
    actorId: order.userId,
    action: 'payment.approved',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: {
      orderId: order.id,
      amountMinor: payment.amountMinor.toString(),
      currency: payment.currency,
      provider: payment.provider,
      latePayment: wasClosed,
    },
  });

  if (wasClosed) {
    const { refundOrderToWallet } = await import('./refunds.js');
    await refundOrderToWallet({
      orderId: order.id,
      reason: 'Paiement confirmé après annulation de la commande.',
    });
    return;
  }

  scheduleFulfillment(order.id);
}

export async function markPaymentFailed(
  paymentId: string,
  reason: string,
  status: 'DECLINED' | 'CANCELED' | 'FAILED' = 'FAILED',
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment) return;
  if (payment.status === 'APPROVED') return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status, failureReason: reason.slice(0, 500) },
  });

  if (payment.order && payment.order.status === 'PENDING_PAYMENT') {
    await prisma.order.update({
      where: { id: payment.order.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason.slice(0, 500),
      },
    });
  }

  await logAudit({
    actorId: payment.order?.userId,
    action: 'payment.failed',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { reason, status },
  });
}

/**
 * Applique l'état réel d'une transaction FedaPay à un paiement local.
 * Le statut et le montant sont toujours revérifiés auprès de l'API.
 */
export async function applyProviderTransaction(
  paymentId: string,
  transaction: FedaPayTransaction,
  source: 'webhook' | 'verification' | 'dev',
): Promise<'processed' | 'ignored'> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return 'ignored';

  if (Number(transaction.amount) !== Number(payment.amountMinor)) {
    await markPaymentFailed(
      payment.id,
      `Montant FedaPay incohérent : attendu ${payment.amountMinor}, reçu ${transaction.amount}.`,
      'FAILED',
    );
    logger.error(
      {
        paymentId: payment.id,
        expected: payment.amountMinor.toString(),
        received: transaction.amount,
        source,
      },
      'Montant FedaPay incohérent',
    );
    return 'ignored';
  }

  if (PAID_STATUSES.has(transaction.status)) {
    await confirmPayment(payment.id);
    return 'processed';
  }

  if (FAILED_STATUSES.has(transaction.status)) {
    await markPaymentFailed(
      payment.id,
      `Paiement ${transaction.status} chez FedaPay.`,
      transaction.status === 'declined' ? 'DECLINED' : 'CANCELED',
    );
    return 'processed';
  }

  return 'ignored';
}

export async function processFedaPayTransaction(
  providerTransactionId: string,
  source: 'webhook' | 'verification' | 'dev',
): Promise<'processed' | 'ignored'> {
  const payment = await prisma.payment.findFirst({
    where: { providerTransactionId },
  });
  if (!payment) {
    logger.warn({ providerTransactionId }, 'Paiement local introuvable pour la transaction FedaPay');
    return 'ignored';
  }

  const client = getFedaPayClient();
  const transaction = await client.getTransaction(providerTransactionId);
  return applyProviderTransaction(payment.id, transaction, source);
}

export async function verifyPaymentForUser(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true, wallet: true },
  });
  if (!payment) throw notFound('Paiement introuvable.');

  const ownerId = payment.order?.userId ?? payment.wallet?.userId;
  if (ownerId !== userId) throw forbidden('Ce paiement ne vous appartient pas.');

  if (payment.providerTransactionId && payment.status !== 'APPROVED') {
    try {
      await processFedaPayTransaction(payment.providerTransactionId, 'verification');
    } catch (error) {
      logger.warn({ err: error, paymentId }, 'Vérification FedaPay impossible');
    }
  }

  const refreshed = await prisma.payment.findUniqueOrThrow({
    where: { id: payment.id },
    include: { order: { select: { reference: true, status: true } } },
  });
  return serializePayment(refreshed);
}

export interface FedaPayEventInput {
  providerTransactionId?: string;
  status?: string;
  eventName?: string;
}

export function parseFedaPayEvent(payload: Record<string, unknown>): FedaPayEventInput {
  const eventName = String(payload.name ?? payload.type ?? payload.event ?? '');
  const entity = (payload.entity ??
    payload.data ??
    payload.transaction ??
    payload) as Record<string, unknown>;
  const id = entity?.id ?? payload.transaction_id;
  const status = entity?.status ?? eventName.split('.').pop();
  return {
    providerTransactionId: id !== undefined ? String(id) : undefined,
    status: status ? String(status) : undefined,
    eventName: eventName || undefined,
  };
}

export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status);
}

export function isFailedStatus(status: string): boolean {
  return FAILED_STATUSES.has(status);
}

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: { order: true; wallet: true };
}>;

export const PAYMENT_METHODS: PaymentMethod[] = ['MOBILE_MONEY', 'CARD', 'WALLET'];
export const PAYMENT_PURPOSES: PaymentPurpose[] = ['ORDER', 'TOPUP'];
export const PAYMENT_CURRENCIES: Currency[] = ['XOF'];
