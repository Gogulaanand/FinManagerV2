import {
  buildBudgetVsActual,
  buildMonthlyTrend,
  calculateBudgetProgress,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
  monthRange,
  trendWindowStart,
} from '@finmanager/core';
import {
  CsvMappingSetSchema,
  TransactionSchema,
  type Account,
  type Budget,
  type Category,
  type CsvMappingSet,
  type Transaction,
} from '@finmanager/schema';
import {
  ACCOUNTS_QUERY,
  BUDGETS_QUERY,
  CATEGORIES_QUERY,
  commitCsvImport as repoCommitCsvImport,
  PROFILE_MAPPINGS_QUERY,
  TRANSACTIONS_MONTH_COUNT_QUERY,
  TRANSACTIONS_MONTH_PAGE_QUERY,
  TRANSACTIONS_WINDOW_QUERY,
  deleteAccount as repoDeleteAccount,
  deleteBudget as repoDeleteBudget,
  deleteCategory as repoDeleteCategory,
  deleteTransaction as repoDeleteTransaction,
  ensureRecurringThrough,
  mapAccountRows,
  mapBudgetRows,
  mapCategoryRows,
  mapTransactionRows,
  saveAccount as repoSaveAccount,
  saveBudget as repoSaveBudget,
  saveCategory as repoSaveCategory,
  saveCsvMappings as repoSaveCsvMappings,
  saveTransaction as repoSaveTransaction,
  seedDefaultCategories,
  uuidv4,
} from '@finmanager/sync';
import { usePowerSync, useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../components/providers';

interface ProfileRow {
  readonly csv_mappings: string | null;
}

interface CountRow {
  readonly count: number;
}

const TRANSACTION_PAGE_SIZE = 50;

function monthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, offset: number): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function rowRecords<T>(rows: readonly T[]): readonly Record<string, unknown>[] {
  return rows as unknown as readonly Record<string, unknown>[];
}

function parseMappings(raw: string | null | undefined): CsvMappingSet {
  if (!raw) return { mappings: [] };
  try {
    return CsvMappingSetSchema.parse(JSON.parse(raw));
  } catch {
    return { mappings: [] };
  }
}

export interface ExpensesApi {
  readonly loading: boolean;
  readonly canWrite: boolean;
  readonly month: string;
  readonly setMonth: (month: string) => void;
  readonly previousMonth: () => void;
  readonly nextMonth: () => void;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly monthTransactions: readonly Transaction[];
  readonly monthTransactionCount: number;
  readonly hasMoreTransactions: boolean;
  readonly loadMoreTransactions: () => void;
  readonly budgets: readonly Budget[];
  readonly mappings: CsvMappingSet;
  readonly summary: ReturnType<typeof calculateMonthlySummary>;
  readonly categoryBreakdown: ReturnType<typeof calculateCategoryBreakdown>;
  readonly budgetProgress: ReturnType<typeof calculateBudgetProgress>;
  readonly monthlyTrend: ReturnType<typeof buildMonthlyTrend>;
  readonly budgetChart: ReturnType<typeof buildBudgetVsActual>;
  readonly saveAccount: (account: Account) => Promise<void>;
  readonly deleteAccount: (id: string) => Promise<void>;
  readonly saveCategory: (category: Category) => Promise<void>;
  readonly deleteCategory: (id: string) => Promise<void>;
  readonly saveTransaction: (transaction: Transaction) => Promise<void>;
  readonly importCsvRows: (
    rows: Parameters<typeof repoCommitCsvImport>[2],
  ) => Promise<{ readonly created: number; readonly skipped: number; readonly failed: number }>;
  readonly deleteTransaction: (id: string) => Promise<void>;
  readonly saveBudget: (budget: Budget) => Promise<void>;
  readonly deleteBudget: (id: string) => Promise<void>;
  readonly saveMappings: (mappings: CsvMappingSet) => Promise<void>;
}

export function useExpenses(): ExpensesApi {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [month, setMonth] = useState(monthNow);
  const [pagination, setPagination] = useState({ month, limit: TRANSACTION_PAGE_SIZE });
  const transactionLimit = pagination.month === month ? pagination.limit : TRANSACTION_PAGE_SIZE;
  const range = useMemo(() => monthRange(month), [month]);
  const windowStart = useMemo(() => trendWindowStart(month, 6), [month]);
  const accountsResult = useQuery<Account>(ACCOUNTS_QUERY);
  const categoriesResult = useQuery<Category>(CATEGORIES_QUERY);
  const windowTransactionsResult = useQuery<Transaction>(TRANSACTIONS_WINDOW_QUERY, [
    windowStart,
    range.endExclusive,
  ]);
  const monthTransactionsResult = useQuery<Transaction>(TRANSACTIONS_MONTH_PAGE_QUERY, [
    range.start,
    range.endExclusive,
    transactionLimit,
  ]);
  const transactionCountResult = useQuery<CountRow>(TRANSACTIONS_MONTH_COUNT_QUERY, [
    range.start,
    range.endExclusive,
  ]);
  const budgetsResult = useQuery<Budget>(BUDGETS_QUERY);
  const mappingsResult = useQuery<ProfileRow>(PROFILE_MAPPINGS_QUERY);
  const loading = [
    accountsResult.data,
    categoriesResult.data,
    windowTransactionsResult.data,
    monthTransactionsResult.data,
    transactionCountResult.data,
    budgetsResult.data,
    mappingsResult.data,
  ].some((data) => data === undefined);
  const accounts = useMemo(
    () => mapAccountRows(rowRecords(accountsResult.data ?? [])),
    [accountsResult.data],
  );
  const categories = useMemo(
    () => mapCategoryRows(rowRecords(categoriesResult.data ?? [])),
    [categoriesResult.data],
  );
  const windowTransactions = useMemo(
    () => mapTransactionRows(rowRecords(windowTransactionsResult.data ?? [])),
    [windowTransactionsResult.data],
  );
  const monthTransactions = useMemo(
    () => mapTransactionRows(rowRecords(monthTransactionsResult.data ?? [])),
    [monthTransactionsResult.data],
  );
  const currentMonthTransactions = useMemo(
    () => windowTransactions.filter((transaction) => transaction.occurredOn.startsWith(month)),
    [month, windowTransactions],
  );
  const monthTransactionCount = Number(transactionCountResult.data?.[0]?.count ?? 0);
  const hasMoreTransactions = monthTransactions.length < monthTransactionCount;
  const budgets = useMemo(
    () => mapBudgetRows(rowRecords(budgetsResult.data ?? [])),
    [budgetsResult.data],
  );
  const mappings = useMemo(
    () => parseMappings(mappingsResult.data?.[0]?.csv_mappings),
    [mappingsResult.data],
  );

  useEffect(() => {
    if (!userId) return;
    void seedDefaultCategories(db, userId).catch(() => undefined);
  }, [db, userId]);

  useEffect(() => {
    if (!userId) return;
    void ensureRecurringThrough(db, userId, month).catch(() => undefined);
  }, [db, month, monthTransactionCount, userId]);

  const summary = useMemo(
    () => calculateMonthlySummary(currentMonthTransactions, categories, month),
    [categories, currentMonthTransactions, month],
  );
  const categoryBreakdown = useMemo(
    () => calculateCategoryBreakdown(currentMonthTransactions, categories, month),
    [categories, currentMonthTransactions, month],
  );
  const budgetProgress = useMemo(
    () => calculateBudgetProgress(budgets, currentMonthTransactions, categories, month),
    [budgets, categories, currentMonthTransactions, month],
  );
  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(windowTransactions, categories, month, 6),
    [categories, month, windowTransactions],
  );
  const budgetChart = useMemo(() => buildBudgetVsActual(budgetProgress), [budgetProgress]);
  const saveAccount = useCallback(
    async (account: Account) => {
      if (userId) await repoSaveAccount(db, userId, account);
    },
    [db, userId],
  );
  const deleteAccount = useCallback(async (id: string) => repoDeleteAccount(db, id), [db]);
  const saveCategory = useCallback(
    async (category: Category) => {
      if (userId) await repoSaveCategory(db, userId, category);
    },
    [db, userId],
  );
  const deleteCategory = useCallback(async (id: string) => repoDeleteCategory(db, id), [db]);
  const saveTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!userId) return;
      const next = TransactionSchema.parse({
        ...transaction,
        id: transaction.id ?? uuidv4(),
        userId,
      });
      await repoSaveTransaction(db, userId, next);
      if (next.isRecurring) await ensureRecurringThrough(db, userId, month);
    },
    [db, month, userId],
  );
  const importCsvRows = useCallback(
    async (rows: Parameters<typeof repoCommitCsvImport>[2]) => {
      if (!userId) return { created: 0, skipped: rows.length, failed: 0 };
      return repoCommitCsvImport(db, userId, rows);
    },
    [db, userId],
  );
  const deleteTransaction = useCallback(async (id: string) => repoDeleteTransaction(db, id), [db]);
  const saveBudget = useCallback(
    async (budget: Budget) => {
      if (userId) await repoSaveBudget(db, userId, budget);
    },
    [db, userId],
  );
  const deleteBudget = useCallback(async (id: string) => repoDeleteBudget(db, id), [db]);
  const saveMappings = useCallback(
    async (next: CsvMappingSet) => {
      if (userId) await repoSaveCsvMappings(db, userId, next);
    },
    [db, userId],
  );

  return {
    loading,
    canWrite: userId !== null,
    month,
    setMonth,
    previousMonth: () => setMonth((current) => shiftMonth(current, -1)),
    nextMonth: () => setMonth((current) => shiftMonth(current, 1)),
    accounts,
    categories,
    transactions: monthTransactions,
    monthTransactions,
    monthTransactionCount,
    hasMoreTransactions,
    loadMoreTransactions: () =>
      setPagination((current) => ({
        month,
        limit:
          (current.month === month ? current.limit : TRANSACTION_PAGE_SIZE) + TRANSACTION_PAGE_SIZE,
      })),
    budgets,
    mappings,
    summary,
    categoryBreakdown,
    budgetProgress,
    monthlyTrend,
    budgetChart,
    saveAccount,
    deleteAccount,
    saveCategory,
    deleteCategory,
    saveTransaction,
    importCsvRows,
    deleteTransaction,
    saveBudget,
    deleteBudget,
    saveMappings,
  };
}
