import { describe, expect, it } from 'vitest';

import { BudgetSchema, TransactionSchema } from './index';

describe('expense contracts', () => {
  it('accepts positive debit amounts and defaults currency to INR', () => {
    expect(
      TransactionSchema.parse({
        amount: 125.5,
        direction: 'debit',
        occurredOn: '2026-07-18',
      }).currency,
    ).toBe('INR');
  });

  it('rejects zero or negative money', () => {
    expect(() =>
      TransactionSchema.parse({ amount: 0, direction: 'debit', occurredOn: '2026-07-18' }),
    ).toThrow();
    expect(() =>
      BudgetSchema.parse({
        categoryId: 'cat',
        period: 'monthly',
        periodStart: '2026-07-01',
        amount: -1,
      }),
    ).toThrow();
  });

  it('rejects directions outside debit and credit', () => {
    expect(() =>
      TransactionSchema.parse({ amount: 1, direction: 'transfer', occurredOn: '2026-07-18' }),
    ).toThrow();
  });
});
