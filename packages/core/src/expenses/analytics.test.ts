import { describe, expect, it } from 'vitest';

import type { Budget, Category, Transaction } from '@finmanager/schema';

import {
  buildBudgetVsActual,
  buildMonthlyTrend,
  calculateBudgetProgress,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
} from './analytics';

const categories: readonly Category[] = [
  {
    id: 'food',
    userId: 'user',
    name: 'Food & Dining',
    kind: 'expense',
    icon: 'utensils',
    color: '#f97316',
    parentId: null,
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: 'salary',
    userId: 'user',
    name: 'Salary',
    kind: 'income',
    icon: 'banknote',
    color: '#047857',
    parentId: null,
    isSystem: true,
    sortOrder: 2,
  },
];

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx',
    userId: 'user',
    accountId: 'account',
    categoryId: 'food',
    amount: 1,
    direction: 'debit',
    currency: 'INR',
    occurredOn: '2026-07-01',
    note: null,
    merchant: null,
    isRecurring: false,
    recurringId: null,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndOn: null,
    recurrenceGeneratedThrough: null,
    importHash: null,
    occurrenceKey: null,
    ...overrides,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget',
    userId: 'user',
    categoryId: 'food',
    period: 'monthly',
    periodStart: '2026-07-01',
    amount: 100,
    ...overrides,
  };
}

describe('expense analytics', () => {
  it('counts only debit transactions as monthly spending and rounds paise', () => {
    const result = calculateMonthlySummary(
      [
        tx({ amount: 100.005, direction: 'debit', occurredOn: '2026-07-02' }),
        tx({ amount: 50, direction: 'credit', categoryId: 'salary', occurredOn: '2026-07-03' }),
        tx({ amount: 80, direction: 'debit', occurredOn: '2026-06-30' }),
      ],
      categories,
      '2026-07',
    );
    expect(result).toMatchObject({ debit: 100.01, credit: 50, net: -50.01, transactionCount: 2 });
  });

  it('marks a category overspent without clamping the ratio', () => {
    const [progress] = calculateBudgetProgress(
      [budget()],
      [tx({ amount: 125, occurredOn: '2026-07-10' })],
      categories,
      '2026-07',
    );
    expect(progress).toMatchObject({
      categoryId: 'food',
      actual: 125,
      remaining: -25,
      ratio: 1.25,
      status: 'overspent',
    });
  });

  it('returns category percentages and renderer-neutral chart series', () => {
    const transactions = [
      tx({ amount: 75, occurredOn: '2026-07-10' }),
      tx({ amount: 25, occurredOn: '2026-07-11' }),
    ];
    const breakdown = calculateCategoryBreakdown(transactions, categories, '2026-07');
    expect(breakdown).toEqual([
      {
        categoryId: 'food',
        label: 'Food & Dining',
        color: '#f97316',
        amount: 100,
        percentage: 100,
      },
    ]);
    expect(buildMonthlyTrend(transactions, categories, '2026-07', 2)).toHaveLength(2);
    expect(
      buildBudgetVsActual([
        calculateBudgetProgress([budget()], transactions, categories, '2026-07')[0]!,
      ]),
    ).toEqual([
      { categoryId: 'food', label: 'Food & Dining', budget: 100, actual: 100, range: 100 },
    ]);
  });
});
