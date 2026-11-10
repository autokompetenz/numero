import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { prisma } from '../db/prisma.js';
import { notFound } from '../lib/errors.js';
import { serializePayment, verifyPaymentForUser } from '../services/payments.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

async function findOwnedPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: { select: { reference: true, status: true, userId: true } },
      wallet: true,
    },
  });
  if (!payment) throw notFound('Paiement introuvable.');
  const ownerId = payment.order?.userId ?? payment.wallet?.userId;
  if (ownerId !== userId) throw notFound('Paiement introuvable.');
  return payment;
}

/**
 * Retrouve un paiement depuis sa référence publique.
 * Utilisé au retour de la page FedaPay (`?payment_ref=...`) pour retrouver
 * la commande associée avant de déclencher sa vérification.
 */
paymentsRouter.get('/by-reference/:reference', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference: req.params.reference },
      include: {
        order: { select: { id: true, reference: true, status: true, userId: true } },
        wallet: true,
      },
    });
    if (!payment) throw notFound('Paiement introuvable.');

    const ownerId = payment.order?.userId ?? payment.wallet?.userId;
    if (ownerId !== req.user!.id) throw notFound('Paiement introuvable.');

    let serialized = serializePayment(payment);
    if (payment.status === 'PENDING') {
      try {
        serialized = await verifyPaymentForUser(payment.id, req.user!.id);
      } catch {
        // La vérification sera retentée par le frontend ; on renvoie l'état connu.
      }
    }

    res.json({
      payment: serialized,
      orderId: payment.order?.id ?? null,
      orderStatus: payment.order?.status ?? null,
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get('/:id', async (req, res, next) => {
  try {
    const payment = await findOwnedPayment(req.params.id, req.user!.id);
    res.json({ payment: serializePayment(payment) });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/:id/verify', paymentLimiter, async (req, res, next) => {
  try {
    const paymentId = req.params.id;
    if (!paymentId) throw notFound('Paiement introuvable.');
    await findOwnedPayment(paymentId, req.user!.id);
    res.json({ payment: await verifyPaymentForUser(paymentId, req.user!.id) });
  } catch (error) {
    next(error);
  }
});
