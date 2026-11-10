import { Currency, ExchangeRates, PaymentMethod, PriceBreakdown, PricingConfig } from '../types';

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  EUR_XOF: 655.957, // Taux officiel fixe zone Franc CFA BCEAO
  USD_XOF: 615.0,   // Taux indicatif moyen
  EUR_USD: 1.0665,
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  targetMarginXof: 2000,          // Marge nette cible minimale : 2 000 XOF
  paymentRateMobileMoney: 0.018,  // 1.8% FedaPay / KKiaPay
  paymentRateCard: 0.036,         // 3.6% Visa / Mastercard
  paymentRateWallet: 0.000,       // 0% pour solde interne
  fixedPaymentFeeXof: 0,
  fxFeeRate: 0.00,
  roundingStepXof: 100,           // Arrondi commercial aux 100 XOF supérieurs
};

/**
 * Calcule le prix de vente exact en respectant la marge nette cible de 2 000 XOF
 * Formule du cahier des charges :
 * P = (C + F + FX + M) / (1 - r)
 */
export function calculateSellingPrice({
  supplierCostXof,
  paymentMethod = 'MOBILE_MONEY',
  targetCurrency = 'XOF',
  config = DEFAULT_PRICING_CONFIG,
  rates = DEFAULT_EXCHANGE_RATES,
}: {
  supplierCostXof: number;
  paymentMethod?: PaymentMethod;
  targetCurrency?: Currency;
  config?: PricingConfig;
  rates?: ExchangeRates;
}): PriceBreakdown {
  const targetMarginXof = config.targetMarginXof;
  const fixedPaymentFeeXof = config.fixedPaymentFeeXof;

  // Détermination du taux de commission selon le moyen de paiement
  let paymentRate = config.paymentRateMobileMoney;
  if (paymentMethod === 'CARD') {
    paymentRate = config.paymentRateCard;
  } else if (paymentMethod === 'WALLET') {
    paymentRate = config.paymentRateWallet;
  }

  // Frais FX éventuels si achat en devise étrangère
  const fxFeeXof = targetCurrency !== 'XOF' ? supplierCostXof * config.fxFeeRate : 0;

  // Calcul du prix brut théorique
  const rawPriceXof =
    (supplierCostXof + targetMarginXof + fixedPaymentFeeXof + fxFeeXof) /
    (1 - paymentRate);

  // Arrondi commercial vers le haut
  const step = config.roundingStepXof > 0 ? config.roundingStepXof : 1;
  const sellingPriceXof = Math.ceil(rawPriceXof / step) * step;

  // Commission réelle calculée sur le prix de vente final
  const paymentFeeXof = Math.round(sellingPriceXof * paymentRate + fixedPaymentFeeXof);

  // Marge nette estimée après tous les coûts imputables
  const estimatedNetMarginXof = sellingPriceXof - supplierCostXof - paymentFeeXof - fxFeeXof;

  // Conversion vers la devise cible
  let rateApplied = 1;
  let sellingPriceInCurrency = sellingPriceXof;

  if (targetCurrency === 'EUR') {
    rateApplied = rates.EUR_XOF;
    // Arrondi au centime supérieur pour ne pas perdre sur la marge
    sellingPriceInCurrency = Math.ceil((sellingPriceXof / rates.EUR_XOF) * 100) / 100;
  } else if (targetCurrency === 'USD') {
    rateApplied = rates.USD_XOF;
    sellingPriceInCurrency = Math.ceil((sellingPriceXof / rates.USD_XOF) * 100) / 100;
  }

  const sellingPriceFormatted = formatCurrency(sellingPriceInCurrency, targetCurrency);

  return {
    supplierCostXof,
    targetMarginXof,
    paymentFeeXof,
    fxFeeXof,
    rawPriceXof,
    sellingPriceXof,
    estimatedNetMarginXof,
    currency: targetCurrency,
    sellingPriceMinor:
      targetCurrency === 'XOF'
        ? Math.round(sellingPriceXof)
        : Math.round(sellingPriceInCurrency * 100),
    sellingPriceFormatted,
    sellingPriceInCurrency,
    rateApplied,
    paymentRate,
  };
}

/**
 * Formatage d'un montant selon la devise
 */
export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'XOF') {
    return `${Math.round(amount).toLocaleString('fr-FR')} XOF`;
  }
  if (currency === 'EUR') {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount} ${currency}`;
}

/**
 * Convertit un montant XOF vers une autre devise
 */
export function convertFromXof(
  amountXof: number,
  targetCurrency: Currency,
  rates = DEFAULT_EXCHANGE_RATES
): number {
  if (targetCurrency === 'XOF') return Math.round(amountXof);
  if (targetCurrency === 'EUR') return Math.round((amountXof / rates.EUR_XOF) * 100) / 100;
  if (targetCurrency === 'USD') return Math.round((amountXof / rates.USD_XOF) * 100) / 100;
  return amountXof;
}

/**
 * Convertit un montant d'une devise vers le XOF
 */
export function convertToXof(
  amount: number,
  fromCurrency: Currency,
  rates = DEFAULT_EXCHANGE_RATES
): number {
  if (fromCurrency === 'XOF') return Math.round(amount);
  if (fromCurrency === 'EUR') return Math.round(amount * rates.EUR_XOF);
  if (fromCurrency === 'USD') return Math.round(amount * rates.USD_XOF);
  return amount;
}
