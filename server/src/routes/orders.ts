import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import {
  cancelUserOrder,
  createOrder,
  getUserOrder,
  listUserOrders,
  refreshUserOrder,
  serializeOrder,
} from '../services/orders.js';
import { serializePayment } from '../services/payments.js';
import { prisma } from '../db/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { getUltraSmsProvider, UltraSmsApiError } from '../providers/ultrasms/index.js';
import { syncOrderFromProvider } from '../services/fulfillment.js';
import { logAudit } from '../services/audit.js';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const createOrderSchema = z.object({
  catalogItemId: z.string().uuid('Article de catalogue invalide.'),
  paymentMethod: z.enum(['MOBILE_MONEY', 'CARD', 'WALLET']),
  currency: z.enum(['XOF', 'EUR', 'USD']).default('XOF'),
  mobileMoneyOperator: z.enum(['MTN', 'MOOV', 'CELTIIS']).optional(),
  mobileMoneyPhone: z.string().trim().min(6).max(30).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

ordersRouter.post('/', paymentLimiter, validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const result = await createOrder({
      userId: req.user!.id,
      ...req.body,
      ipAddress: req.ip ?? null,
    });
    res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/', async (req, res, next) => {
  try {
    res.json({ orders: await listUserOrders(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const order = await getUserOrder(req.params.id, req.user!.id);
    res.json({ order: serializeOrder(order) });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:id/sms', async (req, res, next) => {
  try {
    const order = await getUserOrder(req.params.id, req.user!.id);
    const messages = await prisma.orderSms.findMany({
      where: { orderId: order.id },
      orderBy: { receivedAt: 'desc' },
    });
    res.json({
      smsMessages: messages.map((sms) => ({
        id: sms.id,
        orderId: sms.orderId,
        sender: sms.sender,
        messageText: sms.messageText,
        extractedOtpCode: sms.extractedOtpCode,
        receivedAt: sms.receivedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post('/:id/refresh', async (req, res, next) => {
  try {
    const order = await refreshUserOrder(req.params.id, req.user!.id);
    res.json({ order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const order = await cancelUserOrder(req.params.id, req.user!.id);
    res.json({ order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post('/:id/resend', async (req, res, next) => {
  try {
    const order = await getUserOrder(req.params.id, req.user!.id);
    if (!order.providerOrderId) throw conflict('Aucun numéro fournisseur associé.');
    if (!['PROCESSING', 'COMPLETED'].includes(order.status)) {
      throw conflict('Cette commande ne permet pas de demander un nouvel SMS.');
    }
    const provider = getUltraSmsProvider();
    try {
      await provider.resend(order.providerOrderId);
    } catch (error) {
      const message =
        error instanceof UltraSmsApiError
          ? error.message
          : 'Le fournisseur a refusé la demande.';
      throw conflict(message);
    }
    await syncOrderFromProvider(order.id);
    await logAudit({
      actorId: req.user!.id,
      action: 'order.sms_resend',
      entityType: 'Order',
      entityId: order.id,
    });
    const refreshed = await getUserOrder(order.id, req.user!.id);
    res.json({ order: serializeOrder(refreshed) });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:id/payments', async (req, res, next) => {
  try {
    const order = await getUserOrder(req.params.id, req.user!.id);
    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      payments: payments.map((payment) =>
        serializePayment({ ...payment, order: { reference: order.reference, status: order.status } }),
      ),
    });
  } catch (error) {
    next(error);
  }
});

// Utilisé par le frontend au retour de la page FedaPay.
ordersRouter.post('/:id/verify-payment', async (req, res, next) => {
  try {
    const order = await getUserOrder(req.params.id, req.user!.id);
    const payment = await prisma.payment.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw notFound('Paiement introuvable.');
    const { verifyPaymentForUser } = await import('../services/payments.js');
    const result = await verifyPaymentForUser(payment.id, req.user!.id);
    const refreshed = await getUserOrder(order.id, req.user!.id);
    res.json({ payment: result, order: serializeOrder(refreshed) });
  } catch (error) {
    next(error);
  }
});
