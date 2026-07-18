import {
  buildBudgetVsActual,
  buildMonthlyTrend,
  calculateBudgetProgress,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
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
  TRANSACTIONS_QUERY,
  deleteAccount as repoDeleteAccount,
  deleteBudget as repoDeleteBudget,
  deleteCategory as repoDeleteCategory,
  deleteTransaction as repoDeleteTransaction,
  mapAccountRows,
  mapBudgetRows,
  mapCategoryRows,
  mapTransactionRows,
  materializeRecurringTransactions,
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
  readonly canWrite: boolean;
  readonly month: string;
  readonly setMonth: (month: string) => void;
  readonly previousMonth: () => void;
  readonly nextMonth: () => void;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
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
  ) => Promise<{ readonly created: number; readonly skipped: number }>;
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
  const accountsResult = useQuery<Account>(ACCOUNTS_QUERY);
  const categoriesResult = useQuery<Category>(CATEGORIES_QUERY);
  const transactionsResult = useQuery<Transaction>(TRANSACTIONS_QUERY);
  const budgetsResult = useQuery<Budget>(BUDGETS_QUERY);
  const mappingsResult = useQuery<ProfileRow>(PROFILE_MAPPINGS_QUERY);
  const accounts = useMemo(
    () => mapAccountRows(rowRecords(accountsResult.data ?? [])),
    [accountsResult.data],
  );
  const categories = useMemo(
    () => mapCategoryRows(rowRecords(categoriesResult.data ?? [])),
    [categoriesResult.data],
  );
  const transactions = useMemo(
    () => mapTransactionRows(rowRecords(transactionsResult.data ?? [])),
    [transactionsResult.data],
  );
  const budgets = useMemo(
    () => mapBudgetRows(rowRecords(budgetsResult.data ?? [])),
    [budgetsResult.data],
  );
  const mappings = useMemo(
    () => parseMappings(mappingsResult.data?.[0]?.csv_mappings),
    [mappingsResult.data],
  );

  useEffect(() => {
    if (!userId || categories.length > 0) return;
    void seedDefaultCategories(db, userId).catch(() => undefined);
  }, [categories.length, db, userId]);

  const summary = useMemo(
    () => calculateMonthlySummary(transactions, categories, month),
    [categories, month, transactions],
  );
  const categoryBreakdown = useMemo(
    () => calculateCategoryBreakdown(transactions, categories, month),
    [categories, month, transactions],
  );
  const budgetProgress = useMemo(
    () => calculateBudgetProgress(budgets, transactions, categories, month),
    [budgets, categories, month, transactions],
  );
  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(transactions, categories, month, 6),
    [categories, month, transactions],
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
      if (next.isRecurring) await materializeRecurringTransactions(db, userId, next, month);
    },
    [db, month, userId],
  );
  const importCsvRows = useCallback(
    async (rows: Parameters<typeof repoCommitCsvImport>[2]) => {
      if (!userId) return { created: 0, skipped: rows.length };
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
    canWrite: userId !== null,
    month,
    setMonth,
    previousMonth: () => setMonth((current) => shiftMonth(current, -1)),
    nextMonth: () => setMonth((current) => shiftMonth(current, 1)),
    accounts,
    categories,
    transactions,
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
