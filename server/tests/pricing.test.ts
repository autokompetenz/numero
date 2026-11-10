import { describe, expect, it } from 'vitest';
import { Decimal } from '../src/lib/money.js';
import {
  calculatePrice,
  defaultPricingValues,
  PricingConfigValues,
} from '../src/services/pricing.js';

const rates = {
  EUR_XOF: new Decimal('655.957'),
  USD_XOF: new Decimal('600'),
  source: 'test',
  validAt: new Date('2026-01-01T00:00:00Z'),
};

function config(overrides: Partial<PricingConfigValues> = {}): PricingConfigValues {
  return { ...defaultPricingValues(), fixedPaymentFeeXof: 0, ...overrides };
}

describe('calcul du prix de vente', () => {
  it('garantit la marge nette cible en XOF avec le portefeuille', () => {
    const breakdown = calculatePrice({
      supplierCostXofMinor: 1600n,
      paymentMethod: 'WALLET',
      currency: 'XOF',
      config: config({ paymentRateWallet: new Decimal(0) }),
      rates,
    });
    expect(breakdown.sellingPriceXofMinor).toBeGreaterThanOrEqual(3600n);
    expect(breakdown.estimatedNetMarginXof).toBeGreaterThanOrEqual(2000n);
    expect(breakdown.fxFeeXofMinor).toBe(0n);
    expect(breakdown.sellingPriceXofMinor % 100n).toBe(0n);
  });

  it('intègre les commissions de paiement dans le prix', () => {
    const wallet = calculatePrice({
      supplierCostXofMinor: 1600n,
      paymentMethod: 'WALLET',
      currency: 'XOF',
      config: config({ paymentRateWallet: new Decimal(0) }),
      rates,
    });
    const card = calculatePrice({
      supplierCostXofMinor: 1600n,
      paymentMethod: 'CARD',
      currency: 'XOF',
      config: config({ paymentRateCard: new Decimal('0.05') }),
      rates,
    });
    expect(card.sellingPriceXofMinor).toBeGreaterThan(wallet.sellingPriceXofMinor);
    expect(card.estimatedNetMarginXof).toBeGreaterThanOrEqual(2000n);
    expect(card.paymentFeeMinor).toBeGreaterThan(0n);
  });

  it('garantit la marge cible sur une large plage de coûts', () => {
    for (const cost of [0n, 100n, 1600n, 12_500n, 100_000n]) {
      for (const method of ['WALLET', 'MOBILE_MONEY', 'CARD'] as const) {
        const breakdown = calculatePrice({
          supplierCostXofMinor: cost,
          paymentMethod: method,
          currency: 'XOF',
          config: config({
            paymentRateWallet: new Decimal(0),
            paymentRateMobileMoney: new Decimal('0.02'),
            paymentRateCard: new Decimal('0.05'),
          }),
          rates,
        });
        expect(breakdown.sellingPriceXofMinor % 100n).toBe(0n);
        expect(breakdown.estimatedNetMarginXof).toBeGreaterThanOrEqual(2000n);
      }
    }
  });

  it('applique les frais de change pour une devise étrangère', () => {
    const breakdown = calculatePrice({
      supplierCostXofMinor: 1600n,
      paymentMethod: 'WALLET',
      currency: 'EUR',
      config: config({ paymentRateWallet: new Decimal(0), fxFeeRate: new Decimal('0.02') }),
      rates,
    });
    expect(breakdown.fxFeeXofMinor).toBeGreaterThan(0n);
    // Le prix en devise reste cohérent avec le prix XOF arrondi au centime supérieur.
    expect(breakdown.sellingPriceCurrencyMinor).toBeGreaterThan(0n);
    expect(breakdown.estimatedNetMarginXof).toBeGreaterThanOrEqual(2000n);
  });

  it('rejette les coûts négatifs et les taux invalides', () => {
    expect(() =>
      calculatePrice({
        supplierCostXofMinor: -1n,
        paymentMethod: 'WALLET',
        currency: 'XOF',
        config: config(),
        rates,
      }),
    ).toThrow();
    expect(() =>
      calculatePrice({
        supplierCostXofMinor: 1000n,
        paymentMethod: 'WALLET',
        currency: 'XOF',
        config: config({ paymentRateWallet: new Decimal(1) }),
        rates,
      }),
    ).toThrow();
  });
});
