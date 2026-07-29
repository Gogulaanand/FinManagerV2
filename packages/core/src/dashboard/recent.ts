/**
 * Recent-activity selection for the dashboard.
 *
 * Kept here rather than in the dashboard components so both platforms order and
 * label activity identically, and so the ordering is covered by tests.
 */
import type { Category, Transaction } from '@finmanager/schema';

import { resolveCategoryPresentation } from '../expenses/categories.js';
import { shiftMonth } from '../expenses/month.js';

export interface RecentActivityRow {
  readonly id: string;
  /** Merchant when recorded, otherwise the note, otherwise a neutral fallback. */
  readonly label: string;
  readonly categoryLabel: string;
  readonly categoryIcon: string;
  readonly categoryColor: string;
  readonly occurredOn: string;
  /** Rupees, signed for display: negative is money out. */
  readonly amount: number;
}

const UNCATEGORISED = 'Uncategorised';

/**
 * The most recent transactions, newest first.
 *
 * Transactions carry only a date, so same-day entries are ordered by their
 * position in the input - which is the query's ordering - rather than being
 * given a fabricated time.
 */
export function selectRecentActivity(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  limit = 5,
): RecentActivityRow[] {
  if (limit <= 0) return [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return [...transactions]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, limit)
    .map((transaction, index) => {
      const category = transaction.categoryId
        ? categoryById.get(transaction.categoryId)
        : undefined;
      const presentation = resolveCategoryPresentation(category);
      return {
        id: transaction.id ?? `recent-${index}`,
        label: transaction.merchant?.trim() || transaction.note?.trim() || 'Transaction',
        categoryLabel: category?.name ?? UNCATEGORISED,
        categoryIcon: presentation.icon,
        categoryColor: presentation.color,
        occurredOn: transaction.occurredOn,
        amount: transaction.direction === 'debit' ? -transaction.amount : transaction.amount,
      };
    });
}

/**
 * Change in spend against the previous month, as a ratio (0.1 is 10% more).
 *
 * Null when there is no comparable previous month or it had no spend - a
 * "+100%" against zero is noise, and the dashboard should show nothing rather
 * than a figure that cannot be interpreted.
 */
export function spendChangeRatio(
  trend: readonly { readonly month: string; readonly debit: number }[],
  month: string,
): number | null {
  const current = trend.find((point) => point.month === month);
  const previous = trend.find((point) => point.month === shiftMonth(month, -1));
  if (!current || !previous || previous.debit <= 0) return null;
  return (current.debit - previous.debit) / previous.debit;
}
