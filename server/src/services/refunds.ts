import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { notFound } from '../lib/errors.js';
import { creditWallet } from './wallet.js';
import { logAudit } from './audit.js';

export interface RefundResult {
  refundId: string;
  amountMinor: string;
  currency: string;
  manualProviderRefundRequired: boolean;
}

/**
 * Rembourse une commande sur le portefeuille du client.
 *
 * Décision produit : le client est remboursé immédiatement en interne, même si
 * le paiement initial a été effectué par FedaPay. Le remboursement vers le
 * moyen de paiement d'origine (Mobile Money) est ensuite traité manuellement
 * depuis le tableau de bord FedaPay, car l'API ne l'expose pas.
 */
export async function refundOrderToWallet(params: {
  orderId: string;
  reason: string;
  actorId?: string | null;
  cancelStatus?: 'CANCELLED' | 'REFUNDED';
}): Promise<RefundResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      payments: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
      refunds: { where: { status: 'COMPLETED' } },
    },
  });
  if (!order) throw notFound('Commande introuvable.');

  const existing = order.refunds[0];
  if (existing) {
    return {
      refundId: existing.id,
      amountMinor: existing.amountMinor.toString(),
      currency: existing.currency,
      manualProviderRefundRequired: existing.paymentId
        ? Boolean(
            (
              await prisma.payment.findUnique({ where: { id: existing.paymentId } })
            )?.provider !== 'WALLET',
          )
        : false,
    };
  }

  const payment = order.payments[0];
  if (!payment) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: params.cancelStatus ?? 'CANCELLED',
        cancellationReason: params.reason,
      },
    });
    await logAudit({
      actorId: params.actorId,
      action: 'order.cancel.no_payment',
      entityType: 'Order',
      entityId: order.id,
      metadata: { reason: params.reason },
    });
    return null;
  }

  // Crédit idempotent : un seul remboursement possible par commande.
  await creditWallet({
    userId: order.userId,
    currency: payment.currency,
    amountMinor: payment.amountMinor,
    type: 'REFUND',
    description: `Remboursement ${order.reference} — ${params.reason}`,
    idempotencyKey: `refund:${order.id}`,
    metadata: { orderId: order.id, paymentId: payment.id, reason: params.reason },
    referencePrefix: 'REF',
  });

  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      orderId: order.id,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      reason: params.reason,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: params.cancelStatus ?? 'REFUNDED',
      cancellationReason: params.reason,
      ...(params.cancelStatus === 'CANCELLED' ? { completedAt: null } : {}),
    },
  });

  const manualProviderRefundRequired = payment.provider !== 'WALLET';
  if (manualProviderRefundRequired) {
    logger.warn(
      {
        orderId: order.id,
        paymentId: payment.id,
        provider: payment.provider,
        amountMinor: payment.amountMinor.toString(),
        currency: payment.currency,
      },
      'Remboursement wallet effectué — remboursement FedaPay manuel requis',
    );
  }

  await logAudit({
    actorId: params.actorId,
    action: 'order.refund',
    entityType: 'Order',
    entityId: order.id,
    metadata: {
      reason: params.reason,
      refundId: refund.id,
      manualProviderRefundRequired,
      amountMinor: payment.amountMinor.toString(),
      currency: payment.currency,
    },
  });

  return {
    refundId: refund.id,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
    manualProviderRefundRequired,
  };
}
