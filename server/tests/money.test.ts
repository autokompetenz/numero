import { describe, expect, it } from 'vitest';
import {
  amountToMinor,
  convertCurrencyMinorToXofMinor,
  convertXofMinorToCurrencyMinor,
  minorToAmount,
  minorToString,
  parsePositiveAmountToMinor,
} from '../src/lib/money.js';

describe('unités mineures', () => {
  it('convertit les montants sans flottant', () => {
    expect(amountToMinor('5.79', 'EUR')).toBe(579n);
    expect(amountToMinor(5.79, 'EUR')).toBe(579n);
    expect(amountToMinor(12.345, 'USD')).toBe(1235n);
    expect(amountToMinor(3600, 'XOF')).toBe(3600n);
  });

  it('rend les montants majeurs avec la bonne précision', () => {
    expect(minorToAmount(579n, 'EUR')).toBe(5.79);
    expect(minorToAmount(3600n, 'XOF')).toBe(3600);
    expect(minorToString(579n, 'EUR')).toBe('5.79');
    expect(minorToString(3600n, 'XOF')).toBe('3600');
  });

  it('refuse au-delà de la précision de la devise', () => {
    expect(() => parsePositiveAmountToMinor('10.5', 'XOF')).toThrow();
    expect(() => parsePositiveAmountToMinor('0', 'XOF')).toThrow();
    expect(() => parsePositiveAmountToMinor('-5', 'EUR')).toThrow();
    expect(parsePositiveAmountToMinor('10.5', 'EUR')).toBe(1050n);
  });

  it('applique les bornes de recharge', () => {
    expect(() =>
      parsePositiveAmountToMinor(100, 'XOF', { minMinor: 500n }),
    ).toThrow();
    expect(
      parsePositiveAmountToMinor(2000, 'XOF', { minMinor: 500n, maxMinor: 5000n }),
    ).toBe(2000n);
    expect(() =>
      parsePositiveAmountToMinor(6000, 'XOF', { minMinor: 500n, maxMinor: 5000n }),
    ).toThrow();
  });

  it('arrondit les conversions au plus proche supérieur', () => {
    // 10 EUR = 6 559,57 XOF, arrondi supérieur 6 560.
    expect(convertCurrencyMinorToXofMinor(1000n, 'EUR', '655.957')).toBe(6_560n);
    expect(convertXofMinorToCurrencyMinor(655_957n, 'EUR', '655.957')).toBe(100_000n);
    expect(convertXofMinorToCurrencyMinor(3600n, 'XOF', '1')).toBe(3600n);
  });
});
