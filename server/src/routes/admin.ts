import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, paginationSchema } from '../middleware/validate.js';
import { prisma } from '../db/prisma.js';
import { forbidden, notFound } from '../lib/errors.js';
import {
  listAdminCatalog,
  serializeBreakdown,
  syncCatalogFromProvider,
  updateCatalogItem,
} from '../services/catalog.js';
import { serializeOrder, listProcessingOrders } from '../services/orders.js';
import { refundOrderToWallet } from '../services/refunds.js';
import { syncOrderFromProvider } from '../services/fulfillment.js';
import { getUltraSmsProvider } from '../providers/ultrasms/index.js';
import { getPricingConfig } from '../services/pricing.js';
import { getExchangeRates, invalidateRatesCache } from '../services/exchangeRates.js';
import { logAudit } from '../services/audit.js';
import { calculatePrice } from '../services/pricing.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// -----------------------------------------------------------------------------
// Tableau de bord
// -----------------------------------------------------------------------------
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [
      users,
      orders,
      completed,
      pendingPayment,
      processing,
      revenue,
      refunds,
      manualRefunds,
      recentOrders,
      daily,
      providerBalance,
      walletLiabilities,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.aggregate({
        where: { status: { in: ['COMPLETED', 'PROCESSING', 'PAID'] } },
        _sum: { sellingPriceXofMinor: true, actualMarginXof: true, supplierCostXofMinor: true },
      }),
      prisma.refund.count({ where: { status: 'COMPLETED' } }),
      prisma.refund.findMany({
        where: { status: 'COMPLETED', payment: { provider: { not: 'WALLET' } } },
        include: {
          payment: { include: { order: { select: { reference: true, userId: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.order.findMany({
        include: {
          catalogItem: {
            include: {
              country: { select: { name: true, prefix: true } },
              service: { select: { name: true } },
            },
          },
          smsMessages: true,
          payments: { orderBy: { createdAt: 'desc' } },
          refunds: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.$queryRaw<Array<{ day: Date; count: bigint; revenue: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day,
               COUNT(*)::bigint AS count,
               COALESCE(SUM("sellingPriceXofMinor"), 0)::bigint AS revenue
        FROM "Order"
        WHERE "createdAt" >= NOW() - INTERVAL '14 days'
        GROUP BY day
        ORDER BY day ASC
      `,
      (async () => {
        try {
          return await getUltraSmsProvider().getBalance();
        } catch {
          return null;
        }
      })(),
      // Les soldes clients sont une dette de l'entreprise, jamais du chiffre d'affaires.
      prisma.wallet.aggregate({
        where: { currency: 'XOF' },
        _sum: { balanceMinor: true },
      }),
    ]);

    res.json({
      totals: {
        users,
        orders,
        completed,
        pendingPayment,
        processing,
        refunds,
        revenueXof: Number(revenue._sum.sellingPriceXofMinor ?? 0n),
        supplierCostXof: Number(revenue._sum.supplierCostXofMinor ?? 0n),
        marginXof: Number(revenue._sum.actualMarginXof ?? 0n),
      },
      walletLiabilitiesXof: Number(walletLiabilities._sum.balanceMinor ?? 0n),
      daily: daily.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
        revenueXof: Number(row.revenue),
      })),
      recentOrders: recentOrders.map((order) => ({
        ...serializeOrder(order),
        userEmail: order.user.email,
      })),
      manualRefunds: manualRefunds.map((refund) => ({
        id: refund.id,
        orderReference: refund.payment.order?.reference ?? null,
        amountMinor: Number(refund.amountMinor),
        currency: refund.currency,
        reason: refund.reason,
        createdAt: refund.createdAt.toISOString(),
        provider: refund.payment.provider,
      })),
      provider: {
        name: 'ultrasms',
        mode: getUltraSmsProvider().mode,
        balance: providerBalance,
      },
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// Commandes
// -----------------------------------------------------------------------------
const ordersQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
      'REFUNDED',
      'FAILED',
    ])
    .optional(),
  search: z.string().trim().max(120).optional(),
});

adminRouter.get('/orders', validateQuery(ordersQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query as unknown as z.infer<
      typeof ordersQuerySchema
    >;
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' as const } },
              { phoneNumber: { contains: search } },
              { user: { email: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          catalogItem: {
            include: {
              country: { select: { name: true, prefix: true } },
              service: { select: { name: true } },
            },
          },
          smsMessages: true,
          payments: { orderBy: { createdAt: 'desc' } },
          refunds: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({
      total,
      page,
      limit,
      orders: orders.map((order) => ({
        ...serializeOrder(order),
        userEmail: order.user.email,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/orders/:id/refund', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw notFound('Commande introuvable.');
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason : 'Remboursement administrateur.';
    const refund = await refundOrderToWallet({
      orderId: order.id,
      reason,
      actorId: req.user!.id,
    });
    res.json({ refund });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/orders/:id/sync', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw notFound('Commande introuvable.');
    const refreshed = await syncOrderFromProvider(order.id);
    res.json({ order: refreshed ? serializeOrder(refreshed) : null });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/orders/processing/list', async (_req, res, next) => {
  try {
    res.json({ orders: await listProcessingOrders(100) });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// Utilisateurs
// -----------------------------------------------------------------------------
adminRouter.get('/users', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        include: {
          wallets: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({
      total,
      page,
      limit,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        country: user.country,
        phone: user.phone,
        preferredCurrency: user.preferredCurrency,
        createdAt: user.createdAt.toISOString(),
        ordersCount: user._count.orders,
        wallets: user.wallets.map((wallet) => ({
          currency: wallet.currency,
          balanceMinor: Number(wallet.balanceMinor),
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

const updateUserSchema = z.object({
  role: z.enum(['CLIENT', 'ADMIN', 'SUPPORT']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

adminRouter.patch('/users/:id', validateBody(updateUserSchema), async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      throw forbidden('Vous ne pouvez pas modifier votre propre compte administrateur.');
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
    });
    await logAudit({
      actorId: req.user!.id,
      action: 'admin.user_updated',
      entityType: 'User',
      entityId: user.id,
      metadata: req.body,
    });
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Réinitialise le mot de passe d'un utilisateur et renvoie un mot de passe
 * temporaire affiché une seule fois. Toutes ses sessions sont révoquées.
 */
adminRouter.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      throw forbidden('Modifiez votre propre mot de passe depuis votre profil.');
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('Utilisateur introuvable.');

    const temporaryPassword = randomBytes(12).toString('base64url');
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    await logAudit({
      actorId: req.user!.id,
      action: 'admin.user_password_reset',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });

    res.json({
      user: { id: user.id, email: user.email },
      temporaryPassword,
      message:
        'Communiquez ce mot de passe temporaire par un canal sûr. Il ne sera plus affiché.',
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// Tarification et taux
// -----------------------------------------------------------------------------
adminRouter.get('/pricing', async (_req, res, next) => {
  try {
    const pricing = await getPricingConfig();
    res.json({
      pricing: {
        targetMarginXof: pricing.targetMarginXof,
        paymentRateMobileMoney: Number(pricing.paymentRateMobileMoney),
        paymentRateCard: Number(pricing.paymentRateCard),
        paymentRateWallet: Number(pricing.paymentRateWallet),
        fixedPaymentFeeXof: pricing.fixedPaymentFeeXof,
        fxFeeRate: Number(pricing.fxFeeRate),
        roundingStepXof: pricing.roundingStepXof,
      },
    });
  } catch (error) {
    next(error);
  }
});

const pricingSchema = z.object({
  targetMarginXof: z.coerce.number().int().min(2000).max(1_000_000).optional(),
  paymentRateMobileMoney: z.coerce.number().min(0).max(0.2).optional(),
  paymentRateCard: z.coerce.number().min(0).max(0.2).optional(),
  paymentRateWallet: z.coerce.number().min(0).max(0.2).optional(),
  fixedPaymentFeeXof: z.coerce.number().int().min(0).max(100_000).optional(),
  fxFeeRate: z.coerce.number().min(0).max(0.1).optional(),
  roundingStepXof: z.coerce.number().int().min(1).max(10_000).optional(),
});

adminRouter.patch('/pricing', validateBody(pricingSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof pricingSchema>;
    const updated = await prisma.pricingConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        updatedBy: req.user!.id,
        ...(data.targetMarginXof !== undefined
          ? { targetMarginXof: data.targetMarginXof }
          : {}),
        ...(data.paymentRateMobileMoney !== undefined
          ? { paymentRateMobileMoney: data.paymentRateMobileMoney.toString() }
          : {}),
        ...(data.paymentRateCard !== undefined
          ? { paymentRateCard: data.paymentRateCard.toString() }
          : {}),
        ...(data.paymentRateWallet !== undefined
          ? { paymentRateWallet: data.paymentRateWallet.toString() }
          : {}),
        ...(data.fixedPaymentFeeXof !== undefined
          ? { fixedPaymentFeeXof: data.fixedPaymentFeeXof }
          : {}),
        ...(data.fxFeeRate !== undefined ? { fxFeeRate: data.fxFeeRate.toString() } : {}),
        ...(data.roundingStepXof !== undefined
          ? { roundingStepXof: data.roundingStepXof }
          : {}),
      },
      update: {
        updatedBy: req.user!.id,
        ...(data.targetMarginXof !== undefined
          ? { targetMarginXof: data.targetMarginXof }
          : {}),
        ...(data.paymentRateMobileMoney !== undefined
          ? { paymentRateMobileMoney: data.paymentRateMobileMoney.toString() }
          : {}),
        ...(data.paymentRateCard !== undefined
          ? { paymentRateCard: data.paymentRateCard.toString() }
          : {}),
        ...(data.paymentRateWallet !== undefined
          ? { paymentRateWallet: data.paymentRateWallet.toString() }
          : {}),
        ...(data.fixedPaymentFeeXof !== undefined
          ? { fixedPaymentFeeXof: data.fixedPaymentFeeXof }
          : {}),
        ...(data.fxFeeRate !== undefined ? { fxFeeRate: data.fxFeeRate.toString() } : {}),
        ...(data.roundingStepXof !== undefined
          ? { roundingStepXof: data.roundingStepXof }
          : {}),
      },
    });
    await logAudit({
      actorId: req.user!.id,
      action: 'admin.pricing_updated',
      entityType: 'PricingConfig',
      entityId: updated.id,
      metadata: data,
    });
    res.json({
      pricing: {
        targetMarginXof: updated.targetMarginXof,
        paymentRateMobileMoney: Number(updated.paymentRateMobileMoney),
        paymentRateCard: Number(updated.paymentRateCard),
        paymentRateWallet: Number(updated.paymentRateWallet),
        fixedPaymentFeeXof: updated.fixedPaymentFeeXof,
        fxFeeRate: Number(updated.fxFeeRate),
        roundingStepXof: updated.roundingStepXof,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/rates', async (_req, res, next) => {
  try {
    const rates = await getExchangeRates(true);
    res.json({
      rates: {
        EUR_XOF: Number(rates.EUR_XOF),
        USD_XOF: Number(rates.USD_XOF),
        source: rates.source,
        validAt: rates.validAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

const rateSchema = z.object({
  baseCurrency: z.enum(['EUR', 'USD']),
  rate: z.coerce.number().positive().max(10_000),
  source: z.string().trim().min(1).max(40).default('manual'),
});

adminRouter.post('/rates', validateBody(rateSchema), async (req, res, next) => {
  try {
    const now = new Date();
    const created = await prisma.exchangeRate.create({
      data: {
        baseCurrency: req.body.baseCurrency,
        quoteCurrency: 'XOF',
        rate: req.body.rate.toString(),
        source: req.body.source,
        validAt: now,
      },
    });
    invalidateRatesCache();
    await logAudit({
      actorId: req.user!.id,
      action: 'admin.rate_created',
      entityType: 'ExchangeRate',
      entityId: created.id,
      metadata: {
        baseCurrency: created.baseCurrency,
        rate: created.rate.toString(),
        source: created.source,
      },
    });
    res.status(201).json({
      rate: {
        baseCurrency: created.baseCurrency,
        quoteCurrency: created.quoteCurrency,
        rate: Number(created.rate),
        source: created.source,
        validAt: created.validAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/rates/history', async (_req, res, next) => {
  try {
    const history = await prisma.exchangeRate.findMany({
      orderBy: { validAt: 'desc' },
      take: 100,
    });
    res.json({
      rates: history.map((rate) => ({
        id: rate.id,
        baseCurrency: rate.baseCurrency,
        quoteCurrency: rate.quoteCurrency,
        rate: Number(rate.rate),
        source: rate.source,
        validAt: rate.validAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// Catalogue
// -----------------------------------------------------------------------------
adminRouter.get(
  '/catalog',
  validateQuery(
    paginationSchema.extend({
      search: z.string().trim().min(1).max(80).optional(),
      country: z.string().length(2).optional(),
      service: z.string().min(1).max(80).optional(),
      type: z.enum(['TEMPORARY', 'RENTAL']).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as {
        page: number;
        limit: number;
        search?: string;
        country?: string;
        service?: string;
        type?: 'TEMPORARY' | 'RENTAL';
      };
      const result = await listAdminCatalog({
        page: query.page,
        limit: Math.min(query.limit, 100),
        search: query.search,
        countryCode: query.country,
        serviceId: query.service,
        type: query.type,
      });
      res.json({
        items: result.items.map((item) => ({
          id: item.id,
          countryCode: item.countryCode,
          countryName: item.country.name,
          prefix: item.country.prefix,
          serviceId: item.serviceId,
          serviceName: item.service.name,
          type: item.type,
          supplierCostXof: Number(item.supplierCostXofMinor),
          supplierPriceMinor: item.supplierPriceMinor ? Number(item.supplierPriceMinor) : null,
          supplierCurrency: item.supplierCurrency,
          availableCount: item.availableCount,
          enabled: item.enabled,
          lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
        })),
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (error) {
      next(error);
    }
  },
);

const catalogPatchSchema = z.object({
  enabled: z.boolean().optional(),
  availableCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  supplierCostXofMinor: z.coerce.number().int().min(0).optional(),
});

adminRouter.patch('/catalog/:id', validateBody(catalogPatchSchema), async (req, res, next) => {
  try {
    const catalogId = req.params.id;
    if (!catalogId) throw notFound('Article de catalogue introuvable.');
    await updateCatalogItem(catalogId, {
      enabled: req.body.enabled,
      availableCount: req.body.availableCount,
      supplierCostXofMinor:
        req.body.supplierCostXofMinor !== undefined
          ? BigInt(req.body.supplierCostXofMinor)
          : undefined,
    });
    await logAudit({
      actorId: req.user!.id,
      action: 'admin.catalog_updated',
      entityType: 'CatalogItem',
      entityId: catalogId,
      metadata: req.body,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/catalog/sync', async (req, res, next) => {
  try {
    const result = await syncCatalogFromProvider(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/provider/balance', async (_req, res, next) => {
  try {
    const balance = await getUltraSmsProvider().getBalance();
    res.json({ provider: 'ultrasms', mode: getUltraSmsProvider().mode, balance });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// Audit et remboursements
// -----------------------------------------------------------------------------
adminRouter.get('/audit', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({
      total,
      page,
      limit,
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        actor: log.actor?.email ?? 'système',
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.stringify(log.metadata) : null,
        ipAddress: log.ipAddress,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/refunds', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
    const [total, refunds] = await Promise.all([
      prisma.refund.count(),
      prisma.refund.findMany({
        include: {
          payment: { include: { order: { select: { reference: true, userId: true } } } },
          order: { select: { reference: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({
      total,
      page,
      limit,
      refunds: refunds.map((refund) => ({
        id: refund.id,
        orderReference: refund.order?.reference ?? refund.payment.order?.reference ?? null,
        amountMinor: Number(refund.amountMinor),
        currency: refund.currency,
        reason: refund.reason,
        status: refund.status,
        provider: refund.payment.provider,
        providerRefundId: refund.providerRefundId,
        manualProviderRefundRequired: refund.payment.provider !== 'WALLET',
        createdAt: refund.createdAt.toISOString(),
        completedAt: refund.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/pricing-preview', async (req, res, next) => {
  try {
    const supplierCostXof = Number(req.query.supplierCostXof);
    if (!Number.isFinite(supplierCostXof) || supplierCostXof < 0) {
      throw notFound('supplierCostXof est requis.');
    }
    const [pricing, rates] = await Promise.all([getPricingConfig(), getExchangeRates()]);
    const breakdown = calculatePrice({
      supplierCostXofMinor: BigInt(Math.round(supplierCostXof)),
      paymentMethod: 'MOBILE_MONEY',
      currency: 'XOF',
      config: pricing,
      rates,
    });
    res.json({ price: serializeBreakdown(breakdown) });
  } catch (error) {
    next(error);
  }
});
