'use client';

/**
 * Dashboard figures, composed from the same hooks the detail screens use.
 *
 * Composed rather than re-queried so the dashboard can never disagree with the
 * screen it links to: net worth here is the number Portfolio shows, this
 * month's spend is the number Expenses shows.
 */
import { selectRecentActivity, spendChangeRatio, type RecentActivityRow } from '@finmanager/core';
import type { AllocationRow } from '@finmanager/core';
import { useMemo } from 'react';

import { useExpenses } from '@/lib/expenses';
import { useGoals } from '@/lib/goals';
import { usePortfolio } from '@/lib/portfolio';

export interface DashboardApi {
  readonly loading: boolean;
  /** True once the user has any account, holding or transaction at all. */
  readonly hasData: boolean;
  readonly netWorth: number | null;
  readonly portfolioComplete: boolean;
  readonly missingValuations: number;
  readonly missingFx: number;
  readonly invested: number | null;
  readonly monthSpend: number | null;
  /** Change against the previous month, or null when not comparable. */
  readonly monthSpendChange: number | null;
  readonly monthLabel: string;
  readonly fire: {
    readonly progress: number;
    readonly current: number;
    readonly target: number;
  } | null;
  readonly recentActivity: readonly RecentActivityRow[];
  readonly allocation: readonly AllocationRow[];
}

export function useDashboard(): DashboardApi {
  const portfolio = usePortfolio();
  const expenses = useExpenses();
  const goals = useGoals();

  const recentActivity = useMemo(
    () => selectRecentActivity(expenses.transactions, expenses.categories, 5),
    [expenses.transactions, expenses.categories],
  );

  // FIRE is only meaningful once a target exists; a zero target would render as
  // a full progress bar, which reads as "achieved" rather than "not set up".
  const fire =
    !goals.loading &&
    !portfolio.loading &&
    portfolio.summary.isComplete &&
    goals.fireProjection.fireNumber > 0
      ? {
          progress: goals.fireProjection.progress,
          current: goals.fireProjection.currentCorpus,
          target: goals.fireProjection.fireNumber,
        }
      : null;

  return {
    loading: portfolio.loading || expenses.loading || goals.loading,
    hasData:
      portfolio.accounts.length > 0 ||
      portfolio.holdings.length > 0 ||
      expenses.transactions.length > 0,
    netWorth: portfolio.loading ? null : portfolio.summary.netWorth,
    portfolioComplete: portfolio.summary.isComplete,
    missingValuations: portfolio.summary.unvaluedHoldingCount,
    missingFx: portfolio.summary.missingFxCount,
    invested: portfolio.loading ? null : portfolio.summary.investedValue,
    monthSpend: expenses.loading ? null : expenses.summary.debit,
    monthSpendChange: expenses.loading
      ? null
      : spendChangeRatio(expenses.monthlyTrend, expenses.month),
    monthLabel: expenses.month,
    fire,
    recentActivity,
    allocation: portfolio.summary.allocation,
  };
}
