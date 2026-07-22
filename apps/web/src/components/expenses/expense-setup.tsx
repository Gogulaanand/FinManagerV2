'use client';

import { AccountSchema, CategorySchema, type Account, type Category } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field, Input, SelectField } from '@/components/ui/input';
import type { ExpensesApi } from '@/lib/expenses';

const accountTypes = [
  { value: 'bank', label: 'Bank' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'broker', label: 'Broker' },
] as const;

export function ExpenseSetup({ api }: { readonly api: ExpensesApi }): React.JSX.Element {
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('bank');
  const [accountBalance, setAccountBalance] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState<Category['kind']>('expense');
  const [message, setMessage] = useState<string | null>(null);

  async function saveAccount() {
    const parsed = AccountSchema.safeParse({
      name: accountName,
      type: accountType,
      currentBalance: accountBalance,
    });
    if (!parsed.success) return;
    await api.saveAccount(parsed.data);
    setAccountName('');
    setAccountBalance(0);
    setMessage('Account saved.');
  }

  async function saveCategory() {
    const parsed = CategorySchema.safeParse({ name: categoryName, kind: categoryKind });
    if (!parsed.success) return;
    await api.saveCategory(parsed.data);
    setCategoryName('');
    setMessage('Category saved.');
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>Accounts</CardTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Account name">
              {(id) => (
                <Input
                  id={id}
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="Account name"
                />
              )}
            </Field>
            <SelectField
              label="Type"
              value={accountType}
              options={accountTypes}
              onChange={setAccountType}
            />
            <Field label="Current balance">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  value={accountBalance || ''}
                  onChange={(event) => setAccountBalance(Number(event.target.value))}
                  placeholder="Current balance"
                />
              )}
            </Field>
          </div>
          <Button
            type="button"
            onClick={() => void saveAccount()}
            disabled={!accountName.trim() || !api.canWrite}
          >
            Add account
          </Button>
          {api.accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between border-t border-border/60 pt-2"
            >
              <span className="font-body text-body-md text-foreground">{account.name}</span>
              <span className="font-body text-caption text-foreground-muted">
                {account.type} · ₹{account.currentBalance.toLocaleString('en-IN')}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (account.id && window.confirm(`Delete account “${account.name}”?`))
                    void api.deleteAccount(account.id);
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-4">
          <CardTitle>Categories</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category name">
              {(id) => (
                <Input
                  id={id}
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Category name"
                />
              )}
            </Field>
            <SelectField
              label="Kind"
              value={categoryKind}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
              onChange={setCategoryKind}
            />
          </div>
          <Button
            type="button"
            onClick={() => void saveCategory()}
            disabled={!categoryName.trim() || !api.canWrite}
          >
            Add category
          </Button>
          {api.categories.slice(0, 8).map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between border-t border-border/60 pt-2"
            >
              <span className="font-body text-body-md text-foreground">{category.name}</span>
              <span className="font-body text-caption text-foreground-muted">{category.kind}</span>
              {!category.isSystem ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (category.id && window.confirm(`Delete category “${category.name}”?`))
                      void api.deleteCategory(category.id);
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ))}
        </Card>
      </div>
      {message ? <p className="font-body text-caption text-foreground-muted">{message}</p> : null}
    </>
  );
}
