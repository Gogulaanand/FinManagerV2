import type { Category, Transaction } from '@finmanager/schema';
import { describe, expect, it } from 'vitest';

import { selectRecentActivity, spendChangeRatio } from './recent.js';

const categories = [
  { id: 'c1', name: 'Food', kind: 'expense', color: '#111', isArchived: false },
  { id: 'c2', name: 'Salary', kind: 'income', color: '#222', isArchived: false },
] as unknown as Category[];

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    accountId: null,
    categoryId: 'c1',
    amount: 100,
    direction: 'debit',
    currency: 'INR',
    occurredOn: '2026-07-01',
    note: null,
    merchant: 'Shop',
    isRecurring: false,
    recurringId: null,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndOn: null,
    recurrenceGeneratedThrough: null,
    importHash: null,
    occurrenceKey: null,
    ...overrides,
  } as Transaction;
}

describe('selectRecentActivity', () => {
  it('returns nothing for a user with no transactions', () => {
    expect(selectRecentActivity([], categories)).toEqual([]);
  });

  it('orders newest first and respects the limit', () => {
    const rows = selectRecentActivity(
      [
        txn({ id: 'a', occurredOn: '2026-07-01' }),
        txn({ id: 'b', occurredOn: '2026-07-20' }),
        txn({ id: 'c', occurredOn: '2026-07-10' }),
      ],
      categories,
      2,
    );
    expect(rows.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('signs debits negative and credits positive', () => {
    const rows = selectRecentActivity(
      [
        txn({ id: 'out', amount: 840, direction: 'debit' }),
        txn({ id: 'in', amount: 145000, direction: 'credit', categoryId: 'c2' }),
      ],
      categories,
    );
    expect(rows.find((row) => row.id === 'out')?.amount).toBe(-840);
    expect(rows.find((row) => row.id === 'in')?.amount).toBe(145000);
  });

  it('resolves the category name and falls back when there is none', () => {
    const rows = selectRecentActivity(
      [txn({ id: 'a', categoryId: 'c1' }), txn({ id: 'b', categoryId: null })],
      categories,
    );
    expect(rows.find((row) => row.id === 'a')?.categoryLabel).toBe('Food');
    expect(rows.find((row) => row.id === 'b')?.categoryLabel).toBe('Uncategorised');
  });

  it('falls back to the note, then a neutral label, when no merchant is recorded', () => {
    const rows = selectRecentActivity(
      [
        txn({ id: 'a', merchant: null, note: 'Cash withdrawal' }),
        txn({ id: 'b', merchant: '   ', note: null }),
      ],
      categories,
    );
    expect(rows.find((row) => row.id === 'a')?.label).toBe('Cash withdrawal');
    expect(rows.find((row) => row.id === 'b')?.label).toBe('Transaction');
  });

  it('does not mutate the caller’s array', () => {
    const input = [
      txn({ id: 'a', occurredOn: '2026-07-01' }),
      txn({ id: 'b', occurredOn: '2026-07-20' }),
    ];
    selectRecentActivity(input, categories);
    expect(input.map((row) => row.id)).toEqual(['a', 'b']);
  });
});

describe('spendChangeRatio', () => {
  const trend = [
    { month: '2026-05', debit: 40000 },
    { month: '2026-06', debit: 50000 },
    { month: '2026-07', debit: 45000 },
  ];

  it('compares against the previous calendar month', () => {
    expect(spendChangeRatio(trend, '2026-07')).toBeCloseTo(-0.1, 10);
    expect(spendChangeRatio(trend, '2026-06')).toBeCloseTo(0.25, 10);
  });

  it('returns null when there is nothing meaningful to compare against', () => {
    // No earlier month in the window.
    expect(spendChangeRatio(trend, '2026-05')).toBeNull();
    // A previous month with no spend would render as a meaningless +100%.
    expect(
      spendChangeRatio(
        [
          { month: '2026-06', debit: 0 },
          { month: '2026-07', debit: 900 },
        ],
        '2026-07',
      ),
    ).toBeNull();
    expect(spendChangeRatio(trend, '2026-09')).toBeNull();
  });
});
