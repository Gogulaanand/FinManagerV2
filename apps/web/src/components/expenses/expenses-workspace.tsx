'use client';

import { AccountSchema, CategorySchema, type Account, type Category, type Transaction } from '@finmanager/schema';
import { useState } from 'react';

import { Amount } from '@/components/amount';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { Input, SelectField } from '@/components/ui/input';
import { useExpenses } from '@/lib/expenses';

import { BudgetSection } from './budget-section';
import { CsvImport } from './csv-import';
import { ExpenseCharts } from './expense-charts';
import { TransactionForm } from './transaction-form';

const accountTypes = [
  { value: 'bank', label: 'Bank' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'broker', label: 'Broker' },
] as const;

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function displayAmount(transaction: Transaction): number {
  return transaction.direction === 'debit' ? -transaction.amount : transaction.amount;
}

export function ExpensesWorkspace() {
  const api = useExpenses();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('bank');
  const [accountBalance, setAccountBalance] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState<Category['kind']>('expense');
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  async function saveAccount() {
    const parsed = AccountSchema.safeParse({ name: accountName, type: accountType, currentBalance: accountBalance });
    if (!parsed.success) return;
    await api.saveAccount(parsed.data);
    setAccountName('');
    setAccountBalance(0);
    setSetupMessage('Account saved.');
  }

  async function saveCategory() {
    const parsed = CategorySchema.safeParse({ name: categoryName, kind: categoryKind });
    if (!parsed.success) return;
    await api.saveCategory(parsed.data);
    setCategoryName('');
    setSetupMessage('Category saved.');
  }

  async function importRows(rows: readonly { readonly accountId: string | null; readonly categoryId: string | null; readonly amount: number; readonly direction: 'debit' | 'credit'; readonly currency: 'INR' | 'USD' | 'EUR' | 'GBP'; readonly occurredOn: string; readonly note: string | null; readonly merchant: string | null; readonly importHash: string | null }[]) {
    for (const row of rows) {
      await api.saveTransaction({ ...row, isRecurring: false, recurringId: null, recurrenceFrequency: null, recurrenceInterval: 1, recurrenceEndOn: null, recurrenceGeneratedThrough: null, occurrenceKey: null });
    }
    setSetupMessage(`${rows.length} CSV rows imported.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-lg text-foreground">Expenses</h1>
          <p className="font-body text-body-md text-foreground-muted">Track spending, income, and the month ahead.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={api.previousMonth} aria-label="Previous month">←</Button>
          <span className="min-w-32 text-center font-body text-body-md text-foreground">{monthLabel(api.month)}</span>
          <Button type="button" variant="outline" size="icon" onClick={api.nextMonth} aria-label="Next month">→</Button>
          <Button type="button" onClick={() => { setEditing(null); setShowTransactionForm(true); }} disabled={!api.canWrite}>Add transaction</Button>
        </div>
      </div>
      {!api.canWrite ? <Card><p className="font-body text-body-md text-foreground-muted">Sign in to save accounts, transactions, and budgets offline and sync them across devices.</p></Card> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardLabel>Spent this month</CardLabel><Amount value={api.summary.debit} size="section" /><p className="font-body text-caption text-foreground-muted">{api.summary.transactionCount} transactions</p></Card>
        <Card><CardLabel>Income this month</CardLabel><Amount value={api.summary.credit} size="section" /><p className="font-body text-caption text-foreground-muted">Positive cash inflows</p></Card>
        <Card><CardLabel>Net cash flow</CardLabel><Amount value={api.summary.net} size="section" signed /><p className="font-body text-caption text-foreground-muted">Income minus spending</p></Card>
      </div>
      {showTransactionForm ? <TransactionForm key={editing?.id ?? 'new'} accounts={api.accounts} categories={api.categories} initialTransaction={editing} onSave={async (transaction) => { await api.saveTransaction(transaction); setShowTransactionForm(false); setEditing(null); }} onCancel={() => { setShowTransactionForm(false); setEditing(null); }} /> : null}
      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle><CardLabel>{api.transactions.filter((transaction) => transaction.occurredOn.startsWith(api.month)).length} this month</CardLabel></CardHeader>
        {api.transactions.filter((transaction) => transaction.occurredOn.startsWith(api.month)).length === 0 ? (
          <p className="font-body text-body-md text-foreground-muted">No transactions yet. Add your first expense to start the month.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {api.transactions.filter((transaction) => transaction.occurredOn.startsWith(api.month)).map((transaction) => {
              const category = api.categories.find((item) => item.id === transaction.categoryId);
              return <li key={transaction.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="truncate font-body text-body-md text-foreground">{transaction.merchant || transaction.note || 'Transaction'}</p><p className="font-body text-caption text-foreground-muted">{category?.name ?? 'Uncategorised'} · {transaction.occurredOn}</p></div>
                <div className="flex items-center gap-3"><Amount value={displayAmount(transaction)} signed /><Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(transaction); setShowTransactionForm(true); }}>Edit</Button><Button type="button" size="sm" variant="ghost" onClick={() => void api.deleteTransaction(transaction.id!)}>Delete</Button></div>
              </li>;
            })}
          </ul>
        )}
      </Card>
      <BudgetSection month={api.month} categories={api.categories} progress={api.budgetProgress} onSave={api.saveBudget} onDelete={api.deleteBudget} />
      <ExpenseCharts monthlyTrend={api.monthlyTrend} categoryBreakdown={api.categoryBreakdown} budgetChart={api.budgetChart} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4"><CardTitle>Accounts</CardTitle><div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Account name" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Account name" /><SelectField label="Type" value={accountType} options={accountTypes} onChange={setAccountType} /><Input aria-label="Current balance" type="number" value={accountBalance || ''} onChange={(event) => setAccountBalance(Number(event.target.value))} placeholder="Current balance" /></div><Button type="button" onClick={() => void saveAccount()} disabled={!accountName.trim() || !api.canWrite}>Add account</Button>{api.accounts.map((account) => <div key={account.id} className="flex items-center justify-between border-t border-border/60 pt-2"><span className="font-body text-body-md text-foreground">{account.name}</span><span className="font-body text-caption text-foreground-muted">{account.type} · ₹{account.currentBalance.toLocaleString('en-IN')}</span><Button type="button" size="sm" variant="ghost" onClick={() => void api.deleteAccount(account.id!)}>Delete</Button></div>)}</Card>
        <Card className="flex flex-col gap-4"><CardTitle>Categories</CardTitle><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category name" /><SelectField label="Kind" value={categoryKind} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} onChange={setCategoryKind} /></div><Button type="button" onClick={() => void saveCategory()} disabled={!categoryName.trim() || !api.canWrite}>Add category</Button>{api.categories.slice(0, 8).map((category) => <div key={category.id} className="flex items-center justify-between border-t border-border/60 pt-2"><span className="font-body text-body-md text-foreground">{category.name}</span><span className="font-body text-caption text-foreground-muted">{category.kind}</span>{!category.isSystem ? <Button type="button" size="sm" variant="ghost" onClick={() => void api.deleteCategory(category.id!)}>Delete</Button> : null}</div>)}</Card>
      </div>
      <CsvImport mappings={api.mappings} onSaveMappings={api.saveMappings} onImport={importRows} />
      {setupMessage ? <p className="font-body text-caption text-foreground-muted">{setupMessage}</p> : null}
    </div>
  );
}
