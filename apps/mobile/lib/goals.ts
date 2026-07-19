import {
  calculateFireProjection,
  calculateGoalProjections,
  calculatePortfolioSummary,
  calculateRetirementCorpus,
  suggestAnnualExpenses,
  type FireProjection,
  type GoalProjection,
  type RetirementCorpus,
} from '@finmanager/core';
import {
  FireSettingsSchema,
  GoalSchema,
  type Account,
  type FireSettings,
  type Goal,
  type Holding,
  type HoldingEvent,
  type Transaction,
  type Valuation,
} from '@finmanager/schema';
import {
  ACCOUNTS_QUERY,
  FIRE_SETTINGS_QUERY,
  GOALS_QUERY,
  HOLDING_EVENTS_QUERY,
  HOLDINGS_QUERY,
  TRANSACTIONS_QUERY,
  VALUATIONS_QUERY,
  deleteGoal as repoDeleteGoal,
  mapAccountRows,
  mapFireSettingsRows,
  mapGoalRows,
  mapHoldingEventRows,
  mapHoldingRows,
  mapTransactionRows,
  mapValuationRows,
  saveFireSettings as repoSaveFireSettings,
  saveGoal as repoSaveGoal,
} from '@finmanager/sync';
import { usePowerSync, useQuery } from '@powersync/react';
import { useCallback, useMemo } from 'react';

import { useAuth } from '../components/providers';

function rowRecords<T>(rows: readonly T[]): readonly Record<string, unknown>[] {
  return rows as unknown as readonly Record<string, unknown>[];
}

/** Sum of debit amounts per calendar month, for the trailing window. */
function monthlyExpenseTotals(transactions: readonly Transaction[], window = 12): number[] {
  const byMonth = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.direction !== 'debit') continue;
    const month = transaction.occurredOn.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + transaction.amount);
  }
  return [...byMonth.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, window)
    .map(([, total]) => total);
}

/** Average monthly net savings (credits minus debits), floored at zero. */
function averageMonthlySavings(transactions: readonly Transaction[], window = 12): number {
  const byMonth = new Map<string, number>();
  for (const transaction of transactions) {
    const month = transaction.occurredOn.slice(0, 7);
    const signed = transaction.direction === 'credit' ? transaction.amount : -transaction.amount;
    byMonth.set(month, (byMonth.get(month) ?? 0) + signed);
  }
  const months = [...byMonth.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, window)
    .map(([, total]) => total);
  if (months.length === 0) return 0;
  return Math.max(0, months.reduce((sum, total) => sum + total, 0) / months.length);
}

export interface MobileGoalsApi {
  readonly loading: boolean;
  readonly canWrite: boolean;
  readonly goals: readonly Goal[];
  readonly holdings: readonly Holding[];
  readonly projections: readonly GoalProjection[];
  readonly fireSettings: FireSettings;
  readonly fireProjection: FireProjection;
  readonly retirement: RetirementCorpus;
  readonly netWorth: number;
  readonly monthlyContribution: number;
  /** Savings rate implied by recent transactions, before any explicit override. */
  readonly derivedMonthlySavings: number;
  readonly suggestedAnnualExpenses: number | null;
  readonly saveGoal: (goal: Goal) => Promise<string | null>;
  readonly deleteGoal: (id: string) => Promise<void>;
  readonly saveFireSettings: (settings: FireSettings) => Promise<string | null>;
}

export function useGoals(): MobileGoalsApi {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const goalsResult = useQuery<Goal>(GOALS_QUERY);
  const fireResult = useQuery<FireSettings>(FIRE_SETTINGS_QUERY);
  const holdingsResult = useQuery<Holding>(HOLDINGS_QUERY);
  const eventsResult = useQuery<HoldingEvent>(HOLDING_EVENTS_QUERY);
  const valuationsResult = useQuery<Valuation>(VALUATIONS_QUERY);
  const accountsResult = useQuery<Account>(ACCOUNTS_QUERY);
  const transactionsResult = useQuery<Transaction>(TRANSACTIONS_QUERY);

  const loading = [
    goalsResult.data,
    fireResult.data,
    holdingsResult.data,
    eventsResult.data,
    valuationsResult.data,
    accountsResult.data,
    transactionsResult.data,
  ].some((data) => data === undefined);

  const goals = useMemo(() => mapGoalRows(rowRecords(goalsResult.data ?? [])), [goalsResult.data]);
  const holdings = useMemo(
    () => mapHoldingRows(rowRecords(holdingsResult.data ?? [])),
    [holdingsResult.data],
  );
  const events = useMemo(
    () => mapHoldingEventRows(rowRecords(eventsResult.data ?? [])),
    [eventsResult.data],
  );
  const valuations = useMemo(
    () => mapValuationRows(rowRecords(valuationsResult.data ?? [])),
    [valuationsResult.data],
  );
  const accounts = useMemo(
    () => mapAccountRows(rowRecords(accountsResult.data ?? [])),
    [accountsResult.data],
  );
  const transactions = useMemo(
    () => mapTransactionRows(rowRecords(transactionsResult.data ?? [])),
    [transactionsResult.data],
  );

  const storedFireSettings = useMemo(
    () => mapFireSettingsRows(rowRecords(fireResult.data ?? [])),
    [fireResult.data],
  );

  const netWorth = useMemo(
    () => calculatePortfolioSummary(holdings, events, valuations, accounts).netWorth,
    [holdings, events, valuations, accounts],
  );

  const suggestedAnnualExpenses = useMemo(
    () => suggestAnnualExpenses(monthlyExpenseTotals(transactions)),
    [transactions],
  );
  const derivedMonthlySavings = useMemo(() => averageMonthlySavings(transactions), [transactions]);

  const projections = useMemo(
    () => calculateGoalProjections(goals, { holdings, valuations }),
    [goals, holdings, valuations],
  );

  const retirement = useMemo(
    () => calculateRetirementCorpus(holdings, valuations),
    [holdings, valuations],
  );

  const fireSettings = useMemo<FireSettings>(() => {
    const base = storedFireSettings ?? FireSettingsSchema.parse({});
    if (base.annualExpenses === null && suggestedAnnualExpenses !== null) {
      return { ...base, annualExpenses: suggestedAnnualExpenses };
    }
    return base;
  }, [storedFireSettings, suggestedAnnualExpenses]);

  // The explicit monthly investment wins; otherwise fall back to the savings
  // rate derived from recent income-minus-expense transactions.
  const monthlyContribution = fireSettings.monthlyInvestment ?? derivedMonthlySavings;

  const fireProjection = useMemo(
    () =>
      calculateFireProjection({
        settings: fireSettings,
        currentCorpus: netWorth,
        monthlyContribution,
      }),
    [fireSettings, netWorth, monthlyContribution],
  );

  const saveGoal = useCallback(
    async (input: Goal) =>
      userId ? repoSaveGoal(db, userId, GoalSchema.parse({ ...input, userId })) : null,
    [db, userId],
  );
  const deleteGoal = useCallback(
    (id: string) => (userId ? repoDeleteGoal(db, userId, id) : Promise.resolve()),
    [db, userId],
  );
  const saveFireSettings = useCallback(
    async (input: FireSettings) =>
      userId
        ? repoSaveFireSettings(db, userId, FireSettingsSchema.parse({ ...input, userId }))
        : null,
    [db, userId],
  );

  return {
    loading,
    canWrite: userId !== null,
    goals,
    holdings,
    projections,
    fireSettings,
    fireProjection,
    retirement,
    netWorth,
    monthlyContribution,
    derivedMonthlySavings,
    suggestedAnnualExpenses,
    saveGoal,
    deleteGoal,
    saveFireSettings,
  };
}
