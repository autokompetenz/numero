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
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: {
        payments: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
        refunds: { where: { status: 'COMPLETED' } },
      },
    });
    if (!order) throw notFound('Commande introuvable.');

    const existing = order.refunds[0];
    if (existing) {
      const payment = await tx.payment.findUnique({ where: { id: existing.paymentId } });
      return {
        order,
        payment,
        refund: existing,
        created: false,
      };
    }

    const payment = order.payments[0];
    if (!payment) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: params.cancelStatus ?? 'CANCELLED',
          cancellationReason: params.reason,
        },
      });
      return { order, payment: null, refund: null, created: true };
    }

    await creditWallet({
      userId: order.userId,
      currency: payment.currency,
      amountMinor: payment.amountMinor,
      type: 'REFUND',
      description: `Remboursement ${order.reference} — ${params.reason}`,
      idempotencyKey: `refund:${order.id}`,
      metadata: { orderId: order.id, paymentId: payment.id, reason: params.reason },
      referencePrefix: 'REF',
      tx,
    });

    const refund = await tx.refund.create({
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

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: params.cancelStatus ?? 'REFUNDED',
        cancellationReason: params.reason,
        ...(params.cancelStatus === 'CANCELLED' ? { completedAt: null } : {}),
      },
    });

    return { order: updatedOrder, payment, refund, created: true };
  });

  if (!result.payment) {
    await logAudit({
      actorId: params.actorId,
      action: 'order.cancel.no_payment',
      entityType: 'Order',
      entityId: result.order.id,
      metadata: { reason: params.reason },
    });
    return null;
  }

  const refund = result.refund;
  if (!refund) throw new Error('Écriture de remboursement absente après transaction.');

  const manualProviderRefundRequired = result.payment.provider !== 'WALLET';
  if (result.created && manualProviderRefundRequired) {
    logger.warn(
      {
        orderId: result.order.id,
        paymentId: result.payment.id,
        provider: result.payment.provider,
        amountMinor: result.payment.amountMinor.toString(),
        currency: result.payment.currency,
      },
      'Remboursement wallet effectué — remboursement FedaPay manuel requis',
    );
  }

  await logAudit({
    actorId: params.actorId,
    action: 'order.refund',
    entityType: 'Order',
    entityId: result.order.id,
    metadata: {
      reason: params.reason,
      refundId: refund.id,
      manualProviderRefundRequired,
      amountMinor: result.payment.amountMinor.toString(),
      currency: result.payment.currency,
    },
  });

  return {
    refundId: refund.id,
    amountMinor: result.payment.amountMinor.toString(),
    currency: result.payment.currency,
    manualProviderRefundRequired,
  };
}
