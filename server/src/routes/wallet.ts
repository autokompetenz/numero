import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { prisma } from '../db/prisma.js';
import { getWallet, listTransactions, listWallets } from '../services/wallet.js';
import { minorToAmount } from '../lib/money.js';
import { createTopUp } from '../services/payments.js';
import { notFound } from '../lib/errors.js';

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get('/', async (req, res, next) => {
  try {
    const wallets = await listWallets(req.user!.id);
    res.json({
      wallets: wallets.map((wallet) => ({
        currency: wallet.currency,
        balanceMinor: Number(wallet.balanceMinor),
        balance: minorToAmount(wallet.balanceMinor, wallet.currency),
        updatedAt: wallet.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

const transactionsQuerySchema = z.object({
  currency: z.enum(['XOF', 'EUR', 'USD']).default('XOF'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

walletRouter.get('/transactions', validateQuery(transactionsQuerySchema), async (req, res, next) => {
  try {
    const { currency, limit } = req.query as unknown as z.infer<typeof transactionsQuerySchema>;
    const transactions = await listTransactions(req.user!.id, currency, limit);
    res.json({
      currency,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        date: tx.createdAt.toISOString(),
        type: tx.type,
        currency: tx.currency,
        amount: minorToAmount(tx.amountMinor, tx.currency),
        amountMinor: Number(tx.amountMinor),
        balanceAfter: minorToAmount(tx.balanceAfterMinor, tx.currency),
        balanceAfterMinor: Number(tx.balanceAfterMinor),
        status: tx.status,
        description: tx.description,
        idempotencyKey: tx.idempotencyKey,
      })),
    });
  } catch (error) {
    next(error);
  }
});

walletRouter.get('/payments/:paymentId', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: { order: { select: { reference: true, status: true } }, wallet: true },
    });
    if (!payment) throw notFound('Paiement introuvable.');
    const ownerId = payment.order
      ? (await prisma.order.findUnique({ where: { id: payment.orderId! }, select: { userId: true } }))?.userId
      : payment.wallet?.userId;
    if (ownerId !== req.user!.id) throw notFound('Paiement introuvable.');
    const { verifyPaymentForUser } = await import('../services/payments.js');
    res.json({ payment: await verifyPaymentForUser(payment.id, req.user!.id) });
  } catch (error) {
    next(error);
  }
});

walletRouter.get('/:currency', async (req, res, next) => {
  try {
    const currency = z.enum(['XOF', 'EUR', 'USD']).parse(req.params.currency);
    const wallet = await getWallet(req.user!.id, currency);
    res.json({
      wallet: {
        currency: wallet.currency,
        balanceMinor: Number(wallet.balanceMinor),
        balance: minorToAmount(wallet.balanceMinor, wallet.currency),
      },
    });
  } catch (error) {
    next(error);
  }
});

const topUpSchema = z.object({
  amountMinor: z.coerce.number().int().min(500).max(1_000_000),
  paymentMethod: z.enum(['MOBILE_MONEY', 'CARD']).default('MOBILE_MONEY'),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

walletRouter.post('/topups', paymentLimiter, validateBody(topUpSchema), async (req, res, next) => {
  try {
    const result = await createTopUp({
      userId: req.user!.id,
      amountMinor: BigInt(req.body.amountMinor),
      paymentMethod: req.body.paymentMethod,
      idempotencyKey: req.body.idempotencyKey,
      ipAddress: req.ip ?? null,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

