import { Order, OrderSms } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { getUltraSmsProvider, UltraSmsApiError, UltraSmsOrder } from '../providers/ultrasms/index.js';
import { getExchangeRates } from './exchangeRates.js';
import { Decimal } from '../lib/money.js';
import { refundOrderToWallet } from './refunds.js';
import { logAudit } from './audit.js';

function extractOtp(message: string): string | null {
  const direct = /(?:code|otp|pin|mot de passe)[^0-9]{0,20}(\d{4,8})/i.exec(message);
  if (direct?.[1]) return direct[1];
  const candidates = message.match(/\b\d{4,8}\b/g);
  return candidates?.[0] ?? null;
}

async function storeProviderSms(order: Order, providerOrder: UltraSmsOrder): Promise<void> {
  const entries: Array<{ providerSmsId: string; code: string | null; text: string; receivedAt: string }> = [];

  if (providerOrder.codes.length > 0) {
    providerOrder.codes.forEach((item, index) => {
      entries.push({
        providerSmsId: `${providerOrder.id}:${index}:${item.code}`,
        code: item.code,
        text: item.text ?? providerOrder.sms ?? '',
        receivedAt: item.receivedAt ?? new Date().toISOString(),
      });
    });
  } else if (providerOrder.code || providerOrder.sms) {
    entries.push({
      providerSmsId: `${providerOrder.id}:code`,
      code: providerOrder.code,
      text: providerOrder.sms ?? '',
      receivedAt: new Date().toISOString(),
    });
  }

  for (const entry of entries) {
    if (!entry.text) continue;
    await prisma.orderSms.upsert({
      where: {
        orderId_providerSmsId: {
          orderId: order.id,
          providerSmsId: entry.providerSmsId,
        },
      },
      create: {
        orderId: order.id,
        providerSmsId: entry.providerSmsId,
        sender: providerOrder.service || order.serviceId,
        messageText: entry.text,
        extractedOtpCode: entry.code ?? extractOtp(entry.text),
        receivedAt: new Date(entry.receivedAt),
        raw: providerOrder as unknown as object,
      },
      update: {
        messageText: entry.text,
        extractedOtpCode: entry.code ?? extractOtp(entry.text),
      },
    });
  }
}

/**
 * Prix fournisseur maximal acceptable, exprimé en cents USD.
 *
 * On n'utilise pas le prix catalogue tel quel : les tarifs Ultra SMS bougent.
 * On autorise donc toute hausse qui préserve la marge nette cible et les frais
 * de paiement déjà encaissés. Au-delà, l'achat est refusé et la commande est
 * remboursée plutôt que de perdre de l'argent.
 */
async function determineMaxPriceCents(orderId: string): Promise<number | undefined> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { catalogItem: true },
  });
  if (!order?.catalogItem) return undefined;
  if (order.catalogItem.supplierCurrency !== 'USD') return undefined;

  const maxSupplierCostXof =
    order.sellingPriceXofMinor -
    order.paymentFeeMinor -
    BigInt(order.targetMarginXof);

  const catalogPriceCents = Number(order.catalogItem.supplierPriceMinor ?? 0n);
  if (maxSupplierCostXof <= 0n) {
    return catalogPriceCents > 0 ? catalogPriceCents : undefined;
  }

  const rates = await getExchangeRates();
  const affordableCents = new Decimal(maxSupplierCostXof.toString())
    .div(rates.USD_XOF)
    .mul(100)
    .floor()
    .toNumber();

  if (!Number.isFinite(affordableCents) || affordableCents <= 0) {
    return catalogPriceCents > 0 ? catalogPriceCents : undefined;
  }

  // Le catalogue reste la référence basse : une baisse de prix ne doit pas
  // déclencher un refus côté fournisseur.
  return Math.max(catalogPriceCents, affordableCents);
}

/**
 * Achète le numéro chez Ultra SMS après confirmation du paiement.
 * En cas d'échec fournisseur, la commande est remboursée automatiquement
 * sur le portefeuille du client.
 */
export async function fulfillOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { catalogItem: { include: { service: true } }, user: true },
  });
  if (!order) return;

  if (order.status === 'PAID' && order.providerOrderId) {
    await syncOrderFromProvider(order.id);
    return;
  }

  if (order.status !== 'PAID') return;

  const provider = getUltraSmsProvider();
  const serviceCode =
    order.catalogItem?.service.providerCode ??
    order.catalogItem?.providerProductId?.split(':')[0];
  if (!serviceCode) {
    logger.error({ orderId: order.id }, 'Service fournisseur introuvable pour la commande');
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'FAILED', failureReason: 'Service fournisseur non configuré.' },
    });
    await refundOrderToWallet({
      orderId: order.id,
      reason: 'Service fournisseur non configuré.',
    });
    return;
  }

  const claimed = await prisma.order.updateMany({
    where: { id: order.id, status: 'PAID' },
    data: { status: 'PROCESSING' },
  });
  if (claimed.count !== 1) return;

  try {
    const maxPriceCents = await determineMaxPriceCents(order.id);
    const providerOrder = await provider.purchase({
      service: serviceCode,
      country: order.countryCode,
      ...(maxPriceCents !== undefined ? { maxPriceCents } : {}),
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        providerOrderId: providerOrder.id,
        phoneNumber: providerOrder.phone || order.phoneNumber,
        status:
          providerOrder.status === 'received' || providerOrder.status === 'finished'
            ? 'COMPLETED'
            : 'PROCESSING',
        ...(providerOrder.status === 'received' || providerOrder.status === 'finished'
          ? { completedAt: new Date() }
          : {}),
      },
    });

    await storeProviderSms(order, providerOrder);

    await logAudit({
      action: 'order.provider_purchase',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        providerOrderId: providerOrder.id,
        providerStatus: providerOrder.status,
        priceCents: providerOrder.priceCents,
      },
    });
  } catch (error) {
    const code = error instanceof UltraSmsApiError ? error.code : 'provider_error';
    const message =
      error instanceof UltraSmsApiError
        ? error.message
        : "Échec de l'achat chez le fournisseur.";

    logger.error({ err: error, orderId: order.id }, 'Échec de fulfillment');
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'FAILED',
        failureReason: `${code}: ${message}`.slice(0, 500),
      },
    });
    await refundOrderToWallet({
      orderId: order.id,
      reason: `Fournisseur indisponible (${code}).`,
    });
  }
}

/**
 * Récupère l'état réel d'une commande fournisseur et synchronise les SMS.
 * Appelé par le poller et par l'endpoint de rafraîchissement côté client.
 */
export async function syncOrderFromProvider(orderId: string): Promise<Order | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.providerOrderId) return order;

  if (['CANCELLED', 'REFUNDED', 'FAILED'].includes(order.status)) return order;

  const provider = getUltraSmsProvider();
  try {
    const providerOrder = await provider.getOrder(order.providerOrderId);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(providerOrder.phone ? { phoneNumber: providerOrder.phone } : {}),
        ...(providerOrder.status === 'received' || providerOrder.status === 'finished'
          ? {
              status: 'COMPLETED',
              ...(order.completedAt ? {} : { completedAt: new Date() }),
            }
          : {}),
      },
    });

    await storeProviderSms(order, providerOrder);

    if (providerOrder.status === 'cancelled') {
      await refundOrderToWallet({
        orderId: order.id,
        reason: 'Commande annulée chez le fournisseur.',
        cancelStatus: 'CANCELLED',
      });
    } else if (providerOrder.status === 'expired' || providerOrder.status === 'failed') {
      await refundOrderToWallet({
        orderId: order.id,
        reason:
          providerOrder.status === 'expired'
            ? 'Aucun SMS reçu avant expiration : remboursement automatique.'
            : 'Échec de la commande fournisseur : remboursement automatique.',
        cancelStatus: 'REFUNDED',
      });
    }

    return prisma.order.findUnique({ where: { id: order.id } });
  } catch (error) {
    if (error instanceof UltraSmsApiError && error.statusCode === 404) {
      logger.warn({ orderId: order.id }, 'Commande absente chez le fournisseur');
      return order;
    }
    logger.error({ err: error, orderId: order.id }, 'Échec de synchronisation fournisseur');
    return order;
  }
}

export function scheduleFulfillment(orderId: string): void {
  setTimeout(() => {
    void fulfillOrder(orderId).catch((error) => {
      logger.error({ err: error, orderId }, 'Fulfillment asynchrone en échec');
    });
  }, 0);
}

export async function getOrderSms(orderId: string): Promise<OrderSms[]> {
  return prisma.orderSms.findMany({
    where: { orderId },
    orderBy: { receivedAt: 'desc' },
  });
}
