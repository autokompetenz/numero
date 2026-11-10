import { Currency } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { Decimal, convertCurrencyMinorToXofMinor, convertXofMinorToCurrencyMinor } from '../lib/money.js';
import { env } from '../config/env.js';

export interface ResolvedRates {
  EUR_XOF: Decimal;
  USD_XOF: Decimal;
  source: string;
  validAt: Date;
}

let cache: { rates: ResolvedRates; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getExchangeRates(force = false): Promise<ResolvedRates> {
  if (!force && cache && cache.expiresAt > Date.now()) {
    return cache.rates;
  }

  const [eur, usd] = await Promise.all([
    prisma.exchangeRate.findFirst({
      where: { baseCurrency: 'EUR', quoteCurrency: 'XOF' },
      orderBy: { validAt: 'desc' },
    }),
    prisma.exchangeRate.findFirst({
      where: { baseCurrency: 'USD', quoteCurrency: 'XOF' },
      orderBy: { validAt: 'desc' },
    }),
  ]);

  const rates: ResolvedRates = {
    EUR_XOF: eur?.rate ?? new Decimal(env.EUR_XOF_RATE),
    USD_XOF: usd?.rate ?? new Decimal(env.USD_XOF_RATE),
    source: eur?.source ?? (usd?.source ?? 'env'),
    validAt: eur?.validAt ?? usd?.validAt ?? new Date(),
  };

  cache = { rates, expiresAt: Date.now() + CACHE_TTL_MS };
  return rates;
}

export function invalidateRatesCache(): void {
  cache = null;
}

export function rateForCurrency(rates: ResolvedRates, currency: Currency): Decimal {
  if (currency === 'EUR') return rates.EUR_XOF;
  if (currency === 'USD') return rates.USD_XOF;
  return new Decimal(1);
}

export function toXofMinor(amountMinor: bigint, currency: Currency, rates: ResolvedRates): bigint {
  return convertCurrencyMinorToXofMinor(amountMinor, currency, rateForCurrency(rates, currency));
}

export function fromXofMinor(xofMinor: bigint, currency: Currency, rates: ResolvedRates): bigint {
  return convertXofMinorToCurrencyMinor(xofMinor, currency, rateForCurrency(rates, currency));
}
