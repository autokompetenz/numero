import { Currency } from '@prisma/client';
import Decimal from 'decimal.js';

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const CURRENCY_DECIMALS: Record<Currency, number> = {
  XOF: 0,
  EUR: 2,
  USD: 2,
};

export function currencyDecimals(currency: Currency): number {
  return CURRENCY_DECIMALS[currency];
}

/** Convertit un montant en unité majeure (ex. 12.34 EUR) en unité mineure (1234). */
export function amountToMinor(value: Decimal.Value, currency: Currency): bigint {
  const decimals = currencyDecimals(currency);
  const scaled = new Decimal(value).mul(new Decimal(10).pow(decimals));
  if (!scaled.isFinite()) throw new Error('Montant invalide.');
  return BigInt(scaled.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
}

/** Convertit une unité mineure en montant majeur (number, pour affichage). */
export function minorToAmount(minor: bigint | number, currency: Currency): number {
  const decimals = currencyDecimals(currency);
  return new Decimal(minor.toString()).div(new Decimal(10).pow(decimals)).toNumber();
}

/** Convertit une unité mineure en Decimal d'unité majeure, sans passer par un flottant. */
export function minorToDecimal(minor: bigint | number, currency: Currency): Decimal {
  return new Decimal(minor.toString()).div(new Decimal(10).pow(currencyDecimals(currency)));
}

/** Représentation textuelle stable : "3300" en XOF, "5.79" en EUR. */
export function minorToString(minor: bigint | number, currency: Currency): string {
  return minorToDecimal(minor, currency).toFixed(currencyDecimals(currency));
}

/** Montant lisible pour les logs et les messages. */
export function formatMinor(minor: bigint | number, currency: Currency): string {
  const value = minorToDecimal(minor, currency).toFixed(currencyDecimals(currency));
  if (currency === 'XOF') {
    return `${new Decimal(value).toNumber().toLocaleString('fr-FR')} XOF`;
  }
  return `${value} ${currency}`;
}

/** Vérifie qu'un montant client est positif, fini et respecte la précision de la devise. */
export function parsePositiveAmountToMinor(
  value: unknown,
  currency: Currency,
  options?: { minMinor?: bigint; maxMinor?: bigint },
): bigint {
  const decimal = new Decimal(value as Decimal.Value);
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new Error('Le montant doit être un nombre positif.');
  }
  const decimals = currencyDecimals(currency);
  if (decimal.decimalPlaces() > decimals) {
    throw new Error(`La devise ${currency} accepte au maximum ${decimals} décimale(s).`);
  }
  const minor = amountToMinor(decimal, currency);
  if (options?.minMinor !== undefined && minor < options.minMinor) {
    throw new Error('Montant inférieur au minimum autorisé.');
  }
  if (options?.maxMinor !== undefined && minor > options.maxMinor) {
    throw new Error('Montant supérieur au maximum autorisé.');
  }
  return minor;
}

/** Conversion d'un montant XOF (unité mineure = XOF) vers une devise cible, en unités mineures. */
export function convertXofMinorToCurrencyMinor(
  xofMinor: bigint,
  targetCurrency: Currency,
  rateXofPerTarget: Decimal.Value,
): bigint {
  if (targetCurrency === 'XOF') return xofMinor;
  const rate = new Decimal(rateXofPerTarget);
  if (rate.lte(0)) throw new Error('Taux de change invalide.');
  const targetMajor = new Decimal(xofMinor.toString()).div(rate);
  const scaled = targetMajor.mul(new Decimal(10).pow(currencyDecimals(targetCurrency)));
  return BigInt(scaled.ceil().toFixed(0));
}

/** Conversion inverse : devise -> XOF, en arrondissant au XOF supérieur. */
export function convertCurrencyMinorToXofMinor(
  amountMinor: bigint,
  sourceCurrency: Currency,
  rateXofPerSource: Decimal.Value,
): bigint {
  if (sourceCurrency === 'XOF') return amountMinor;
  const rate = new Decimal(rateXofPerSource);
  const major = minorToDecimal(amountMinor, sourceCurrency);
  return BigInt(major.mul(rate).ceil().toFixed(0));
}
