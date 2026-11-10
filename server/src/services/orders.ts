import {
  Currency,
  MobileMoneyOperator,
  NumberType,
  Order,
  OrderSms,
  Payment,
  PaymentMethod,
  Prisma,
  Refund,
} from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { conflict, forbidden, insufficientFunds, notFound } from '../lib/errors.js';
import { newReference } from '../lib/ids.js';
import { minorToAmount } from '../lib/money.js';
import { getPricingConfig, calculatePrice } from './pricing.js';
import { getExchangeRates } from './exchangeRates.js';
import { getCatalogItemOrThrow, serializeBreakdown } from './catalog.js';
import { debitWallet, getWallet } from './wallet.js';
import {
  initializeFedaPayCheckout,
  serializePayment,
} from './payments.js';
import { scheduleFulfillment, syncOrderFromProvider } from './fulfillment.js';
import { refundOrderToWallet } from './refunds.js';
import { logAudit } from './audit.js';
import { getUltraSmsProvider, UltraSmsApiError } from '../providers/ultrasms/index.js';

type OrderWithRelations = Order & {
  catalogItem?: {
    country: { name: string; prefix: string } | null;
    service: { name: string } | null;
  } | null;
  smsMessages?: OrderSms[];
  payments?: Payment[];
  refunds?: Refund[];
};

const orderInclude = {
  catalogItem: {
    include: {
      country: { select: { name: true, prefix: true } },
      service: { select: { name: true } },
    },
  },
  smsMessages: { orderBy: { receivedAt: 'desc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  refunds: { orderBy: { createdAt: 'desc' as const } },
};

export function serializeOrder(
  order: OrderWithRelations,
  options: { includePayments?: boolean } = {},
) {
  const latestPayment = order.payments?.[0];
  return {
    id: order.id,
    reference: order.reference,
    userId: order.userId,
    countryCode: order.countryCode,
    countryName: order.catalogItem?.country?.name ?? order.countryCode,
    prefix: order.catalogItem?.country?.prefix ?? '',
    serviceId: order.serviceId,
    serviceName: order.catalogItem?.service?.name ?? order.serviceId,
    phoneNumber: order.phoneNumber,
    type: order.type,
    currency: order.currency,
    supplierCostXof: Number(order.supplierCostXofMinor),
    exchangeRateUsed: Number(order.exchangeRateUsed),
    sellingPriceXof: Number(order.sellingPriceXofMinor),
    sellingPriceCurrency: minorToAmount(order.sellingPriceCurrencyMinor, order.currency),
    paymentFeeXof: Number(order.paymentFeeMinor),
    actualMarginXof: Number(order.actualMarginXof),
    paymentMethod: order.paymentMethod,
    paymentProvider: order.paymentProvider,
    mobileMoneyOperator: order.mobileMoneyOperator,
    mobileMoneyPhone: order.mobileMoneyPhone,
    status: order.status,
    checkoutUrl: order.checkoutUrl,
    failureReason: order.failureReason,
    cancellationReason: order.cancellationReason,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
    smsMessages: (order.smsMessages ?? []).map((sms) => ({
      id: sms.id,
      orderId: sms.orderId,
      sender: sms.sender,
      messageText: sms.messageText,
      extractedOtpCode: sms.extractedOtpCode,
      receivedAt: sms.receivedAt.toISOString(),
    })),
    payment: latestPayment ? serializePayment(latestPayment) : null,
    ...(options.includePayments
      ? { payments: (order.payments ?? []).map((payment) => serializePayment(payment)) }
      : {}),
  };
}

export async function listUserOrders(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return orders.map((order) => serializeOrder(order));
}

export async function getUserOrder(orderId: string, userId: string, isAdmin = false) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!order) throw notFound('Commande introuvable.');
  if (!isAdmin && order.userId !== userId) {
    throw forbidden("Cette commande ne vous appartient pas.");
  }
  return order;
}

export interface CreateOrderInput {
  userId: string;
  catalogItemId: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  mobileMoneyOperator?: MobileMoneyOperator;
  mobileMoneyPhone?: string;
  idempotencyKey?: string;
  ipAddress?: string | null;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: orderInclude,
    });
    if (existing) {
      if (existing.userId !== input.userId) {
        throw conflict("Cette clé d'idempotence appartient à un autre compte.");
      }
      return {
        order: serializeOrder(existing),
        checkoutUrl: existing.checkoutUrl,
        idempotent: true,
      };
    }
  }

  if (input.paymentMethod !== 'WALLET' && input.paymentMethod !== 'MOBILE_MONEY' && input.paymentMethod !== 'CARD') {
    throw conflict('Moyen de paiement non pris en charge.');
  }

  const item = await getCatalogItemOrThrow(input.catalogItemId);
  if (item.availableCount <= 0) {
    throw conflict("Aucun numéro n'est disponible pour ce service.");
  }

  const [config, rates] = await Promise.all([getPricingConfig(), getExchangeRates()]);
  const breakdown = calculatePrice({
    supplierCostXofMinor: item.supplierCostXofMinor,
    paymentMethod: input.paymentMethod,
    currency: input.currency,
    config,
    rates,
  });

  const idempotencyKey =
    input.idempotencyKey ?? `order:${input.userId}:${newReference('IDEM')}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  // Vérification précoce du solde : évite de créer une commande inutile.
  // Les achats par portefeuille sont toujours réglés en XOF : c'est la devise
  // de référence comptable et la seule rechargeable via FedaPay.
  if (input.paymentMethod === 'WALLET') {
    const wallet = await getWallet(input.userId, 'XOF');
    if (wallet.balanceMinor < breakdown.sellingPriceXofMinor) {
      throw insufficientFunds(
        `Solde XOF insuffisant. Rechargez votre portefeuille pour continuer.`,
      );
    }
  }

  const provider = 'ultrasms';
  const paymentProvider = input.paymentMethod === 'WALLET' ? 'WALLET' : 'FEDAPAY';
  const paymentCurrency: Currency = 'XOF';
  const paymentAmount = breakdown.sellingPriceXofMinor;

  const { order, payment } = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        reference: newReference('NUM'),
        userId: input.userId,
        catalogItemId: item.id,
        provider,
        countryCode: item.countryCode,
        serviceId: item.serviceId,
        type: item.type,
        currency: input.currency,
        supplierCostXofMinor: item.supplierCostXofMinor,
        supplierCostCurrency: 'XOF',
        exchangeRateUsed: breakdown.rateApplied.toString(),
        sellingPriceXofMinor: breakdown.sellingPriceXofMinor,
        sellingPriceCurrencyMinor: breakdown.sellingPriceCurrencyMinor,
        paymentFeeMinor: breakdown.paymentFeeMinor,
        targetMarginXof: breakdown.targetMarginXof,
        actualMarginXof: breakdown.estimatedNetMarginXof,
        paymentMethod: input.paymentMethod,
        paymentProvider,
        mobileMoneyOperator:
          input.paymentMethod === 'MOBILE_MONEY'
            ? input.mobileMoneyOperator ?? null
            : null,
        mobileMoneyPhone:
          input.paymentMethod === 'MOBILE_MONEY'
            ? input.mobileMoneyPhone ?? null
            : null,
        status: 'PENDING_PAYMENT',
        idempotencyKey,
        expiresAt,
      },
    });

    const createdPayment = await tx.payment.create({
      data: {
        orderId: createdOrder.id,
        purpose: 'ORDER',
        provider: paymentProvider,
        reference: newReference('PAY'),
        paymentMethod: input.paymentMethod,
        amountMinor: paymentAmount,
        currency: paymentCurrency,
        status: 'PENDING',
        idempotencyKey: `payment:${createdOrder.id}`,
        metadata: {
          displayCurrency: input.currency,
          sellingPriceCurrencyMinor: breakdown.sellingPriceCurrencyMinor.toString(),
          sellingPriceXofMinor: breakdown.sellingPriceXofMinor.toString(),
          paymentFeeMinor: breakdown.paymentFeeMinor.toString(),
        },
      },
    });

    if (input.paymentMethod === 'WALLET') {
      const paidAt = new Date();
      await debitWallet({
        userId: input.userId,
        currency: 'XOF',
        amountMinor: breakdown.sellingPriceXofMinor,
        description: `Achat ${createdOrder.reference} — ${item.serviceId} / ${item.countryCode}`,
        idempotencyKey: `wallet:order:${createdOrder.id}`,
        metadata: { orderId: createdOrder.id },
        referencePrefix: 'PUR',
        tx,
      });
      await tx.payment.update({
        where: { id: createdPayment.id },
        data: { status: 'APPROVED', paidAt },
      });
      await tx.order.update({
        where: { id: createdOrder.id },
        data: { status: 'PAID', paidAt },
      });
    }

    return { order: createdOrder, payment: createdPayment };
  });

  await logAudit({
    actorId: input.userId,
    action: 'order.created',
    entityType: 'Order',
    entityId: order.id,
    ipAddress: input.ipAddress,
    metadata: {
      catalogItemId: item.id,
      paymentMethod: input.paymentMethod,
      sellingPriceXofMinor: breakdown.sellingPriceXofMinor.toString(),
      sellingPriceCurrencyMinor: breakdown.sellingPriceCurrencyMinor.toString(),
      currency: input.currency,
    },
  });

  if (input.paymentMethod === 'WALLET') {
    // L'achat, le débit et les statuts ont été validés dans la transaction
    // qui a créé la commande. Le poller reprendra aussi cette commande après
    // un redémarrage si le processus s'arrête avant l'appel fournisseur.
    scheduleFulfillment(order.id);

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    return { order: serializeOrder(updated), checkoutUrl: null, idempotent: false };
  }

  const checkoutUrl = await initializeFedaPayCheckout(payment.id);
  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });

  return {
    order: serializeOrder(updated),
    checkoutUrl,
    idempotent: false,
    payment: serializePayment(
      await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
    ),
    price: serializeBreakdown(breakdown),
  };
}

export async function refreshUserOrder(orderId: string, userId: string, isAdmin = false) {
  const order = await getUserOrder(orderId, userId, isAdmin);
  if (order.providerOrderId) {
    await syncOrderFromProvider(order.id);
  }
  const refreshed = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });
  return serializeOrder(refreshed);
}

export async function cancelUserOrder(
  orderId: string,
  userId: string,
  options: { isAdmin?: boolean; reason?: string } = {},
) {
  const order = await getUserOrder(orderId, userId, options.isAdmin);
  const reason = options.reason ?? 'Annulation demandée par le client.';

  if (['CANCELLED', 'REFUNDED', 'COMPLETED'].includes(order.status)) {
    throw conflict('Cette commande ne peut plus être annulée.');
  }

  if (order.status === 'PENDING_PAYMENT') {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancellationReason: reason },
    });
    await prisma.payment.updateMany({
      where: { orderId: order.id, status: 'PENDING' },
      data: { status: 'CANCELED', failureReason: reason },
    });
    await logAudit({
      actorId: userId,
      action: 'order.cancelled',
      entityType: 'Order',
      entityId: order.id,
      metadata: { reason },
    });
    const refreshed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    return serializeOrder(refreshed);
  }

  if (order.status === 'PAID') {
    await refundOrderToWallet({ orderId: order.id, reason, actorId: userId });
  } else if (order.status === 'PROCESSING') {
    if (!order.providerOrderId) {
      throw conflict("La commande n'est pas encore initialisée chez le fournisseur.");
    }
    const provider = getUltraSmsProvider();
    try {
      await provider.cancel(order.providerOrderId);
    } catch (error) {
      const message =
        error instanceof UltraSmsApiError
          ? error.message
          : "Le fournisseur n'a pas accepté l'annulation.";
      throw conflict(message);
    }
    await refundOrderToWallet({
      orderId: order.id,
      reason,
      actorId: userId,
      cancelStatus: 'CANCELLED',
    });
  } else if (order.status === 'FAILED') {
    await refundOrderToWallet({ orderId: order.id, reason, actorId: userId });
  }

  const refreshed = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });
  return serializeOrder(refreshed);
}

export async function expirePendingOrders(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', expiresAt: { lt: now } },
    select: { id: true },
    take: 100,
  });
  if (expired.length === 0) return 0;
  const ids = expired.map((order) => order.id);
  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'CANCELLED',
      cancellationReason: 'Délai de paiement dépassé.',
    },
  });
  await prisma.payment.updateMany({
    where: { orderId: { in: ids }, status: 'PENDING' },
    data: { status: 'CANCELED', failureReason: 'Délai de paiement dépassé.' },
  });
  return ids.length;
}

export async function listProcessingOrders(limit = 25) {
  return prisma.order.findMany({
    where: {
      status: 'PROCESSING',
      providerOrderId: { not: null },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
}

/** Les commandes PAID sont la file persistante de fulfillment : le poller
 * les reprend après un redémarrage si le processus a manqué le setTimeout. */
export async function listPaidOrders(limit = 25) {
  return prisma.order.findMany({
    where: { status: 'PAID' },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
}

export function orderTypes(): NumberType[] {
  return ['TEMPORARY', 'RENTAL'];
}

export function assertProductionPaymentMode(): void {
  if (env.NODE_ENV === 'production' && env.PAYMENTS_MODE !== 'live') {
    throw new Error('Le mode sandbox ou mock est interdit en production.');
  }
}

export type { Prisma };
