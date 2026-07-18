import type { Budget, Category, Transaction } from '@finmanager/schema';

import { roundToPaise } from '../money.js';

export interface MonthlySummary {
  readonly debit: number;
  readonly credit: number;
  readonly net: number;
  readonly transactionCount: number;
}

export interface CategoryBreakdown {
  readonly categoryId: string | null;
  readonly label: string;
  readonly color: string;
  readonly amount: number;
  readonly percentage: number;
}

export type BudgetStatus = 'under' | 'nearLimit' | 'overspent';

export interface BudgetProgress {
  readonly budgetId: string | null;
  readonly categoryId: string | null;
  readonly label: string;
  readonly color: string;
  readonly budget: number;
  readonly actual: number;
  readonly remaining: number;
  readonly ratio: number;
  readonly status: BudgetStatus;
}

export interface MonthlyTrendPoint {
  readonly month: string;
  readonly debit: number;
  readonly credit: number;
  readonly net: number;
  readonly range: number;
}

export interface BudgetChartPoint {
  readonly categoryId: string | null;
  readonly label: string;
  readonly budget: number;
  readonly actual: number;
  readonly range: number;
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function inMonth(date: string, month: string): boolean {
  return monthOf(date) === month;
}

function categoryMap(categories: readonly Category[]): ReadonlyMap<string, Category> {
  return new Map(
    categories.flatMap((category) => (category.id ? [[category.id, category] as const] : [])),
  );
}

function sum(values: readonly number[]): number {
  return roundToPaise(values.reduce((total, value) => total + value, 0));
}

function monthFromIndex(endMonth: string, offset: number): string {
  const [yearText, monthText] = endMonth.split('-');
  const start = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  start.setUTCMonth(start.getUTCMonth() - offset);
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function calculateMonthlySummary(
  transactions: readonly Transaction[],
  _categories: readonly Category[],
  month: string,
): MonthlySummary {
  const rows = transactions.filter((transaction) => inMonth(transaction.occurredOn, month));
  const debit = sum(rows.filter((row) => row.direction === 'debit').map((row) => row.amount));
  const credit = sum(rows.filter((row) => row.direction === 'credit').map((row) => row.amount));
  return { debit, credit, net: roundToPaise(credit - debit), transactionCount: rows.length };
}

export function calculateCategoryBreakdown(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: string,
): CategoryBreakdown[] {
  const byId = categoryMap(categories);
  const amounts = new Map<string | null, number[]>();
  for (const transaction of transactions) {
    const category = transaction.categoryId ? byId.get(transaction.categoryId) : undefined;
    if (
      !inMonth(transaction.occurredOn, month) ||
      transaction.direction !== 'debit' ||
      category?.kind !== 'expense'
    ) {
      continue;
    }
    const values = amounts.get(transaction.categoryId) ?? [];
    values.push(transaction.amount);
    amounts.set(transaction.categoryId, values);
  }
  const total = sum([...amounts.values()].map((values) => sum(values)));
  return [...amounts.entries()]
    .map(([categoryId, values]) => {
      const category = categoryId ? byId.get(categoryId) : undefined;
      const amount = sum(values);
      return {
        categoryId,
        label: category?.name ?? 'Uncategorised',
        color: category?.color ?? '#64748b',
        amount,
        percentage: total === 0 ? 0 : roundToPaise((amount / total) * 100),
      };
    })
    .sort((left, right) => right.amount - left.amount);
}

export function calculateBudgetProgress(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: string,
): BudgetProgress[] {
  const byId = categoryMap(categories);
  return budgets
    .filter((budget) => budget.period === 'monthly' && monthOf(budget.periodStart) === month)
    .map((budget) => {
      const category = budget.categoryId ? byId.get(budget.categoryId) : undefined;
      const actual = sum(
        transactions
          .filter(
            (transaction) =>
              inMonth(transaction.occurredOn, month) &&
              transaction.direction === 'debit' &&
              transaction.categoryId === budget.categoryId,
          )
          .map((transaction) => transaction.amount),
      );
      const ratio = actual / budget.amount;
      const status: BudgetStatus = ratio >= 1 ? 'overspent' : ratio >= 0.8 ? 'nearLimit' : 'under';
      return {
        budgetId: budget.id ?? null,
        categoryId: budget.categoryId,
        label: category?.name ?? 'Uncategorised',
        color: category?.color ?? '#64748b',
        budget: roundToPaise(budget.amount),
        actual,
        remaining: roundToPaise(budget.amount - actual),
        ratio,
        status,
      };
    })
    .sort((left, right) => right.actual - left.actual);
}

export function buildMonthlyTrend(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  endMonth: string,
  monthCount: number,
): MonthlyTrendPoint[] {
  return Array.from({ length: Math.max(0, monthCount) }, (_, index) =>
    monthFromIndex(endMonth, monthCount - index - 1),
  ).map((month) => {
    const summary = calculateMonthlySummary(transactions, categories, month);
    return { ...summary, month, range: Math.max(summary.debit, summary.credit) };
  });
}

export function buildBudgetVsActual(progress: readonly BudgetProgress[]): BudgetChartPoint[] {
  return progress.map((item) => ({
    categoryId: item.categoryId,
    label: item.label,
    budget: item.budget,
    actual: item.actual,
    range: Math.max(item.budget, item.actual),
  }));
}
