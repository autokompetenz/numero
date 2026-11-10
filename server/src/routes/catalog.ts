import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { badRequest } from '../lib/errors.js';
import { listCatalog, listEnabledCountries, quoteItem, serializeBreakdown } from '../services/catalog.js';
import { getExchangeRates } from '../services/exchangeRates.js';
import { getPricingConfig } from '../services/pricing.js';
import { env } from '../config/env.js';

export const catalogRouter = Router();

catalogRouter.get('/countries', async (_req, res, next) => {
  try {
    res.json({ countries: await listEnabledCountries() });
  } catch (error) {
    next(error);
  }
});

const catalogQuerySchema = z.object({
  currency: z.enum(['XOF', 'EUR', 'USD']).default('XOF'),
  paymentMethod: z.enum(['MOBILE_MONEY', 'CARD', 'WALLET']).default('MOBILE_MONEY'),
  country: z.string().length(2).optional(),
  service: z.string().min(1).max(80).optional(),
  type: z.enum(['TEMPORARY', 'RENTAL']).optional(),
  category: z.enum(['social', 'ai', 'messaging', 'tech', 'fintech']).optional(),
  search: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

catalogRouter.get('/', validateQuery(catalogQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof catalogQuerySchema>;
    const catalog = await listCatalog({
      currency: query.currency,
      paymentMethod: query.paymentMethod,
      countryCode: query.country,
      serviceId: query.service,
      type: query.type,
      category: query.category,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    res.json(catalog);
  } catch (error) {
    next(error);
  }
});

const quoteSchema = z.object({
  itemId: z.string().min(1),
  currency: z.enum(['XOF', 'EUR', 'USD']).default('XOF'),
  paymentMethod: z.enum(['MOBILE_MONEY', 'CARD', 'WALLET']).default('MOBILE_MONEY'),
});

catalogRouter.get('/quote', validateQuery(quoteSchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof quoteSchema>;
    const result = await quoteItem({
      itemId: query.itemId,
      paymentMethod: query.paymentMethod,
      currency: query.currency,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get('/config', async (_req, res, next) => {
  try {
    const [pricing, rates] = await Promise.all([getPricingConfig(), getExchangeRates()]);
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
      exchangeRates: {
        EUR_XOF: Number(rates.EUR_XOF),
        USD_XOF: Number(rates.USD_XOF),
        EUR_USD: Number(rates.EUR_XOF) / Number(rates.USD_XOF),
        source: rates.source,
        validAt: rates.validAt.toISOString(),
      },
      payments: {
        mode: env.PAYMENTS_MODE,
        currencies: ['XOF'],
        minTopUpXof: 500,
        maxTopUpXof: 1_000_000,
      },
      ultrasms: { mode: env.ULTRASMS_MODE },
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get('/pricing-preview', async (req, res, next) => {
  try {
    const supplierCostXof = Number(req.query.supplierCostXof);
    if (!Number.isFinite(supplierCostXof) || supplierCostXof < 0) {
      throw badRequest('supplierCostXof est requis.');
    }
    const currency = (req.query.currency as 'XOF' | 'EUR' | 'USD' | undefined) ?? 'XOF';
    const paymentMethod =
      (req.query.paymentMethod as 'MOBILE_MONEY' | 'CARD' | 'WALLET' | undefined) ??
      'MOBILE_MONEY';
    const [pricing, rates] = await Promise.all([getPricingConfig(), getExchangeRates()]);
    const { calculatePrice } = await import('../services/pricing.js');
    const breakdown = calculatePrice({
      supplierCostXofMinor: BigInt(Math.round(supplierCostXof)),
      paymentMethod,
      currency,
      config: pricing,
      rates,
    });
    res.json({ price: serializeBreakdown(breakdown) });
  } catch (error) {
    next(error);
  }
});
