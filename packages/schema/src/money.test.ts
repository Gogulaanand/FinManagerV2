import { describe, expect, it } from 'vitest';

import { CurrencyCodeSchema, MoneySchema } from './money';

describe('MoneySchema', () => {
  it('parses a valid amount and defaults currency to INR', () => {
    expect(MoneySchema.parse({ amount: 1500.5 })).toEqual({ amount: 1500.5, currency: 'INR' });
  });

  it('accepts an explicit currency', () => {
    expect(MoneySchema.parse({ amount: 20, currency: 'USD' })).toEqual({
      amount: 20,
      currency: 'USD',
    });
  });

  it('rejects non-finite amounts', () => {
    expect(MoneySchema.safeParse({ amount: Number.NaN }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: Number.POSITIVE_INFINITY }).success).toBe(false);
  });

  it('rejects unknown currencies', () => {
    expect(CurrencyCodeSchema.safeParse('XYZ').success).toBe(false);
  });
});
