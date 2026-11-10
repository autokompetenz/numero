import { Currency, PaymentMethod, PricingConfig } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { Decimal, convertXofMinorToCurrencyMinor, currencyDecimals } from '../lib/money.js';
import { marginTooLow } from '../lib/errors.js';
import { getExchangeRates, rateForCurrency, ResolvedRates } from './exchangeRates.js';

export interface PricingConfigValues {
  targetMarginXof: number;
  paymentRateMobileMoney: Decimal;
  paymentRateCard: Decimal;
  paymentRateWallet: Decimal;
  fixedPaymentFeeXof: number;
  fxFeeRate: Decimal;
  roundingStepXof: number;
}

export interface PriceBreakdown {
  supplierCostXofMinor: bigint;
  targetMarginXof: number;
  paymentFeeMinor: bigint;
  fxFeeXofMinor: bigint;
  rawPriceXof: Decimal;
  sellingPriceXofMinor: bigint;
  estimatedNetMarginXof: bigint;
  currency: Currency;
  sellingPriceCurrencyMinor: bigint;
  rateApplied: Decimal;
  paymentRate: Decimal;
  paymentMethod: PaymentMethod;
}

export function defaultPricingValues(): PricingConfigValues {
  return {
    targetMarginXof: Math.round(env.TARGET_MARGIN_XOF),
    paymentRateMobileMoney: new Decimal(env.PAYMENT_RATE_MOBILE_MONEY),
    paymentRateCard: new Decimal(env.PAYMENT_RATE_CARD),
    paymentRateWallet: new Decimal(env.PAYMENT_RATE_WALLET),
    fixedPaymentFeeXof: 0,
    fxFeeRate: new Decimal(0),
    roundingStepXof: Math.round(env.ROUNDING_STEP_XOF),
  };
}

export function pricingValuesFromRecord(record: PricingConfig): PricingConfigValues {
  return {
    targetMarginXof: record.targetMarginXof,
    paymentRateMobileMoney: new Decimal(record.paymentRateMobileMoney.toString()),
    paymentRateCard: new Decimal(record.paymentRateCard.toString()),
    paymentRateWallet: new Decimal(record.paymentRateWallet.toString()),
    fixedPaymentFeeXof: record.fixedPaymentFeeXof,
    fxFeeRate: new Decimal(record.fxFeeRate.toString()),
    roundingStepXof: record.roundingStepXof,
  };
}

export async function getPricingConfig(): Promise<PricingConfigValues> {
  const record = await prisma.pricingConfig.findUnique({ where: { id: 'default' } });
  if (record) return pricingValuesFromRecord(record);
  const defaults = defaultPricingValues();
  const created = await prisma.pricingConfig.create({
    data: {
      id: 'default',
      targetMarginXof: defaults.targetMarginXof,
      paymentRateMobileMoney: defaults.paymentRateMobileMoney.toString(),
      paymentRateCard: defaults.paymentRateCard.toString(),
      paymentRateWallet: defaults.paymentRateWallet.toString(),
      fixedPaymentFeeXof: defaults.fixedPaymentFeeXof,
      fxFeeRate: defaults.fxFeeRate.toString(),
      roundingStepXof: defaults.roundingStepXof,
    },
  });
  return pricingValuesFromRecord(created);
}

export function paymentRateFor(
  paymentMethod: PaymentMethod,
  config: PricingConfigValues,
): Decimal {
  if (paymentMethod === 'CARD') return config.paymentRateCard;
  if (paymentMethod === 'WALLET') return config.paymentRateWallet;
  return config.paymentRateMobileMoney;
}

/**
 * Calcule le prix de vente en unités mineures, sans flottants.
 * P = (C + F + FX + M) / (1 - r), puis arrondi supérieur au palier.
 */
export function calculatePrice(params: {
  supplierCostXofMinor: bigint;
  paymentMethod: PaymentMethod;
  currency: Currency;
  config: PricingConfigValues;
  rates: ResolvedRates;
  allowBelowTargetMargin?: boolean;
}): PriceBreakdown {
  const { supplierCostXofMinor, paymentMethod, currency, config, rates } = params;

  if (supplierCostXofMinor < 0n) {
    throw new Error('Le coût fournisseur ne peut pas être négatif.');
  }

  const paymentRate = paymentRateFor(paymentMethod, config);
  if (paymentRate.lt(0) || paymentRate.gte(1)) {
    throw new Error('Taux de commission de paiement invalide.');
  }

  const fixed = new Decimal(config.fixedPaymentFeeXof);
  const targetMargin = new Decimal(config.targetMarginXof);
  const fxFee = currency === 'XOF'
    ? new Decimal(0)
    : new Decimal(supplierCostXofMinor.toString()).mul(config.fxFeeRate);

  const rawPriceXof = new Decimal(supplierCostXofMinor.toString())
    .plus(targetMargin)
    .plus(fixed)
    .plus(fxFee)
    .div(new Decimal(1).minus(paymentRate));

  const step = Math.max(1, Math.round(config.roundingStepXof));
  const sellingPriceXofMinor = BigInt(
    rawPriceXof.div(step).ceil().mul(step).toFixed(0),
  );

  const paymentFeeMinor = BigInt(
    new Decimal(sellingPriceXofMinor.toString())
      .mul(paymentRate)
      .plus(fixed)
      .round()
      .toFixed(0),
  );

  const fxFeeXofMinor = BigInt(fxFee.ceil().toFixed(0));
  const estimatedNetMarginXof =
    sellingPriceXofMinor - supplierCostXofMinor - paymentFeeMinor - fxFeeXofMinor;

  if (
    !params.allowBelowTargetMargin &&
    estimatedNetMarginXof < BigInt(config.targetMarginXof)
  ) {
    throw marginTooLow('La marge nette minimale ne peut pas être garantie pour cette commande.', {
      estimatedNetMarginXof: estimatedNetMarginXof.toString(),
      targetMarginXof: config.targetMarginXof,
    });
  }

  const rateApplied = rateForCurrency(rates, currency);
  const sellingPriceCurrencyMinor = convertXofMinorToCurrencyMinor(
    sellingPriceXofMinor,
    currency,
    rateApplied,
  );

  return {
    supplierCostXofMinor,
    targetMarginXof: config.targetMarginXof,
    paymentFeeMinor,
    fxFeeXofMinor,
    rawPriceXof,
    sellingPriceXofMinor,
    estimatedNetMarginXof,
    currency,
    sellingPriceCurrencyMinor,
    rateApplied,
    paymentRate,
    paymentMethod,
  };
}

export async function quoteCatalogItem(params: {
  supplierCostXofMinor: bigint;
  paymentMethod: PaymentMethod;
  currency: Currency;
  allowBelowTargetMargin?: boolean;
}): Promise<PriceBreakdown> {
  const [config, rates] = await Promise.all([getPricingConfig(), getExchangeRates()]);
  return calculatePrice({ ...params, config, rates });
}

/** Nombre de décimales d'affichage pour une devise (utilisé par les DTO). */
export function displayDecimals(currency: Currency): number {
  return currencyDecimals(currency);
}
