import { describe, expect, it } from 'vitest';

import { fxRateToInrForCurrency } from './fx';
import { normalizeCashFlowsToInr, valuationValueInr } from './analytics';

describe('fxRateToInrForCurrency', () => {
  it('does not retain an FX rate for INR', () => {
    expect(fxRateToInrForCurrency('INR', '83')).toBeNull();
  });

  it('normalizes a positive non-INR rate', () => {
    expect(fxRateToInrForCurrency('USD', '83.25')).toBe(83.25);
  });

  it('rejects empty, zero, negative, and non-finite rates', () => {
    expect(fxRateToInrForCurrency('USD', '')).toBeNull();
    expect(fxRateToInrForCurrency('USD', 0)).toBeNull();
    expect(fxRateToInrForCurrency('USD', -1)).toBeNull();
    expect(fxRateToInrForCurrency('USD', Number.NaN)).toBeNull();
  });
});

describe('source-currency form inputs', () => {
  it('keeps an unknown USD valuation incomplete and converts only an explicit rate', () => {
    const valuation = {
      holdingId: '00000000-0000-4000-8000-000000000001',
      asOf: '2026-09-05',
      value: 1000,
      currency: 'USD' as const,
      source: 'manual',
    };
    expect(
      valuationValueInr({ ...valuation, fxRateToInr: fxRateToInrForCurrency('USD', '') }),
    ).toBeNull();
    expect(
      valuationValueInr({ ...valuation, fxRateToInr: fxRateToInrForCurrency('USD', '83.25') }),
    ).toBe(83250);
    expect(
      valuationValueInr({
        ...valuation,
        currency: 'INR',
        fxRateToInr: fxRateToInrForCurrency('INR', ''),
      }),
    ).toBe(1000);
  });

  it('excludes an unknown USD cash flow and reports missing FX instead of assuming parity', () => {
    const result = normalizeCashFlowsToInr([
      {
        holdingId: '00000000-0000-4000-8000-000000000001',
        date: '2026-09-05',
        amount: -1000,
        currency: 'USD',
        fxRateToInr: fxRateToInrForCurrency('USD', ''),
      },
    ]);
    expect(result).toEqual({ flows: [], missingFxCount: 1 });
  });
});
