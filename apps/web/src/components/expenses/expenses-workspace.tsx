'use client';

import { type Transaction } from '@finmanager/schema';
import { resolveCategoryPresentation } from '@finmanager/core';
import { useState } from 'react';
import { useStatus } from '@powersync/react';

import { Amount } from '@/components/amount';
import { CategoryIcon } from '@/components/category-icon';
import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { useExpenses } from '@/lib/expenses';
import { useAuth } from '@/components/providers';

import { BudgetSection } from './budget-section';
import { CsvImport } from './csv-import';
import { ExpenseCharts } from './expense-charts';
import { ExpenseSetup } from './expense-setup';
import { MonthPicker } from './month-picker';
import { TransactionForm } from './transaction-form';

function displayAmount(transaction: Transaction): number {
  return transaction.direction === 'debit' ? -transaction.amount : transaction.amount;
}

export function ExpensesWorkspace() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return <WorkspaceSkeleton label="Loading expenses" />;
  }
  return <ExpensesWorkspaceContent />;
}

function ExpensesWorkspaceContent() {
  const api = useExpenses();
  const initialSkeleton = useInitialSkeleton();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  async function importRows(rows: Parameters<typeof api.importCsvRows>[0]) {
    const result = await api.importCsvRows(rows);
    setSetupMessage(
      `${result.created} CSV rows imported; ${result.skipped} duplicates skipped; ${result.failed} failed.`,
    );
  }

  if (api.loading || initialSkeleton) return <WorkspaceSkeleton label="Loading expenses" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-lg text-foreground">Expenses</h1>
          <p className="font-body text-body-md text-foreground-muted">
            Track spending, income, and the month ahead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={api.previousMonth}
            aria-label="Previous month"
          >
            ←
          </Button>
          <MonthPicker month={api.month} onChange={api.setMonth} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={api.nextMonth}
            aria-label="Next month"
          >
            →
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowTransactionForm(true);
            }}
            disabled={!api.canWrite}
          >
            Add transaction
          </Button>
        </div>
      </div>
      {!api.canWrite ? (
        <Card>
          <p className="font-body text-body-md text-foreground-muted">
            Sign in to save accounts, transactions, and budgets offline and sync them across
            devices.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardLabel>Spent this month</CardLabel>
          <Amount value={api.summary.debit} size="section" />
          <p className="font-body text-caption text-foreground-muted">
            {api.summary.transactionCount} transactions
          </p>
        </Card>
        <Card>
          <CardLabel>Income this month</CardLabel>
          <Amount value={api.summary.credit} size="section" />
          <p className="font-body text-caption text-foreground-muted">Positive cash inflows</p>
        </Card>
        <Card>
          <CardLabel>Net cash flow</CardLabel>
          <Amount value={api.summary.net} size="section" signed />
          <p className="font-body text-caption text-foreground-muted">Income minus spending</p>
        </Card>
      </div>
      <ExpenseCharts
        monthlyTrend={api.monthlyTrend}
        categoryBreakdown={api.categoryBreakdown}
        budgetChart={api.budgetChart}
      />
      {showTransactionForm ? (
        <TransactionForm
          key={editing?.id ?? 'new'}
          accounts={api.accounts}
          categories={api.categories}
          initialTransaction={editing}
          onSave={async (transaction) => {
            await api.saveTransaction(transaction);
            setShowTransactionForm(false);
            setEditing(null);
          }}
          onCancel={() => {
            setShowTransactionForm(false);
            setEditing(null);
          }}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardLabel>
            {api.monthTransactions.length} of {api.monthTransactionCount} this month
          </CardLabel>
        </CardHeader>
        {api.monthTransactions.length === 0 ? (
          <p className="font-body text-body-md text-foreground-muted">
            No transactions yet. Add your first expense to start the month.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {api.monthTransactions.map((transaction) => {
              const category = api.categories.find((item) => item.id === transaction.categoryId);
              return (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CategoryIcon
                      {...resolveCategoryPresentation(category)}
                      label={`${category?.name ?? 'Uncategorised'} category`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-body text-body-md text-foreground">
                        {transaction.merchant || transaction.note || 'Transaction'}
                      </p>
                      <p className="font-body text-caption text-foreground-muted">
                        {category?.name ?? 'Uncategorised'} · {transaction.occurredOn}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Amount value={displayAmount(transaction)} signed />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(transaction);
                        setShowTransactionForm(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          transaction.id &&
                          window.confirm('Delete this transaction? This cannot be undone.')
                        ) {
                          void api.deleteTransaction(transaction.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {api.hasMoreTransactions ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={api.loadMoreTransactions}
          >
            Load more (showing {api.monthTransactions.length} of {api.monthTransactionCount})
          </Button>
        ) : null}
      </Card>
      <BudgetSection
        month={api.month}
        categories={api.categories}
        progress={api.budgetProgress}
        onSave={api.saveBudget}
        onDelete={api.deleteBudget}
      />
      <ExpenseSetup api={api} />
      <CsvImport
        accounts={api.accounts}
        categories={api.categories}
        mappings={api.mappings}
        onCreateCategory={api.saveCategory}
        onSaveMappings={api.saveMappings}
        onImport={importRows}
      />
      {setupMessage ? (
        <p className="font-body text-caption text-foreground-muted">{setupMessage}</p>
      ) : null}
    </div>
  );
}
