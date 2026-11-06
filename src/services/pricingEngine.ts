/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Currency, PaymentMethod, PricingConfig, PriceCalculationResult, ExchangeRates } from '../types';

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  EUR_TO_XOF: 655.957,
  USD_TO_XOF: 610.0,
  XOF_TO_EUR: 1 / 655.957,
  XOF_TO_USD: 1 / 610.0,
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  targetMarginXof: 2000, // Target net margin 2 000 XOF as defined in Cahier des Charges
  paymentRateMomo: 0.025, // 2.5% typical aggregator rate for Mobile Money (FedaPay/KKiaPay)
  paymentRateCard: 0.036, // 3.6% for Visa/Mastercard transactions
  fixedPaymentFeeXof: 0,
  fxFeeXof: 0,
  roundingStepXof: 100, // Round up to nearest 100 XOF
};

/**
 * Calculates selling price following Section 7 of the Cahier des Charges:
 * Formula: P = (C + F + FX + M) / (1 - r)
 * Then rounds up to commercial step.
 */
export function calculateSellingPrice({
  supplierCostXof,
  paymentMethod,
  config = DEFAULT_PRICING_CONFIG,
  targetCurrency = 'XOF',
  rates = DEFAULT_EXCHANGE_RATES,
}: {
  supplierCostXof: number;
  paymentMethod: PaymentMethod;
  config?: PricingConfig;
  targetCurrency?: Currency;
  rates?: ExchangeRates;
}): PriceCalculationResult {
  if (supplierCostXof < 0 || config.targetMarginXof < 0) {
    throw new Error('Amounts must be non-negative');
  }

  // Determine commission rate according to payment method
  let paymentRate = 0;
  if (paymentMethod === 'MOBILE_MONEY') {
    paymentRate = config.paymentRateMomo;
  } else if (paymentMethod === 'CARD') {
    paymentRate = config.paymentRateCard;
  } else if (paymentMethod === 'WALLET') {
    paymentRate = 0; // Internal wallet transaction has 0% direct payment fee
  }

  if (paymentRate < 0 || paymentRate >= 1) {
    throw new Error('Invalid payment rate');
  }

  const { targetMarginXof, fixedPaymentFeeXof, fxFeeXof, roundingStepXof } = config;

  // Theoretical exact price without rounding
  const rawPriceXof = (supplierCostXof + targetMarginXof + fixedPaymentFeeXof + fxFeeXof) / (1 - paymentRate);

  // Commercial price rounded up to nearest step (e.g. 100 XOF)
  const step = roundingStepXof > 0 ? roundingStepXof : 1;
  const sellingPriceXof = Math.ceil(rawPriceXof / step) * step;

  // Real recalculated estimated payment fee
  const estimatedPaymentFeeXof = sellingPriceXof * paymentRate + fixedPaymentFeeXof;

  // Net realized margin after supplier cost, payment fee, and fx fee
  const estimatedNetMarginXof = sellingPriceXof - supplierCostXof - estimatedPaymentFeeXof - fxFeeXof;

  // Conversion to target display currency
  let displayPrice = sellingPriceXof;
  let exchangeRateUsed = 1;

  if (targetCurrency === 'EUR') {
    exchangeRateUsed = rates.XOF_TO_EUR;
    displayPrice = Math.round(sellingPriceXof * rates.XOF_TO_EUR * 100) / 100;
  } else if (targetCurrency === 'USD') {
    exchangeRateUsed = rates.XOF_TO_USD;
    displayPrice = Math.round(sellingPriceXof * rates.XOF_TO_USD * 100) / 100;
  }

  const displayFormatted = formatCurrency(displayPrice, targetCurrency);

  return {
    supplierCostXof,
    targetMarginXof,
    paymentRate,
    fixedPaymentFeeXof,
    fxFeeXof,
    rawPriceXof,
    sellingPriceXof,
    estimatedPaymentFeeXof,
    estimatedNetMarginXof,
    displayCurrency: targetCurrency,
    displayPrice,
    displayFormatted,
    exchangeRateUsed,
  };
}

/**
 * Formats a monetary amount according to currency rules:
 * XOF: 0 decimals (e.g. "3 700 XOF")
 * EUR: 2 decimals (e.g. "5,64 €")
 * USD: 2 decimals (e.g. "$6.07")
 */
export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'XOF') {
    const formatted = Math.round(amount).toLocaleString('fr-FR');
    return `${formatted} XOF`;
  }
  if (currency === 'EUR') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return `${amount} ${currency}`;
}

/**
 * Converts XOF to other currencies
 */
export function convertXof(amountXof: number, targetCurrency: Currency, rates: ExchangeRates = DEFAULT_EXCHANGE_RATES): number {
  if (targetCurrency === 'XOF') return amountXof;
  if (targetCurrency === 'EUR') return Math.round(amountXof * rates.XOF_TO_EUR * 100) / 100;
  if (targetCurrency === 'USD') return Math.round(amountXof * rates.XOF_TO_USD * 100) / 100;
  return amountXof;
}

/**
 * Converts any currency to XOF reference
 */
export function convertToXof(amount: number, sourceCurrency: Currency, rates: ExchangeRates = DEFAULT_EXCHANGE_RATES): number {
  if (sourceCurrency === 'XOF') return Math.round(amount);
  if (sourceCurrency === 'EUR') return Math.round(amount * rates.EUR_TO_XOF);
  if (sourceCurrency === 'USD') return Math.round(amount * rates.USD_TO_XOF);
  return Math.round(amount);
}
