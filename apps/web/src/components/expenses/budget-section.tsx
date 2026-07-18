'use client';

import { BudgetSchema, type Budget, type Category } from '@finmanager/schema';
import { useState } from 'react';

import { Amount } from '@/components/amount';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { CurrencyField, SelectField } from '@/components/ui/input';
import type { ExpensesApi } from '@/lib/expenses';

export interface BudgetSectionProps {
  readonly month: string;
  readonly categories: readonly Category[];
  readonly progress: ExpensesApi['budgetProgress'];
  readonly onSave: (budget: Budget) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}

export function BudgetSection({ month, categories, progress, onSave, onDelete }: BudgetSectionProps) {
  const expenseCategories = categories.filter((category) => category.kind === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = BudgetSchema.safeParse({
      categoryId: categoryId || null,
      period: 'monthly',
      periodStart: `${month}-01`,
      amount,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a positive budget');
      return;
    }
    setError(null);
    await onSave(parsed.data);
    setAmount(0);
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader>
        <CardTitle>Monthly budgets</CardTitle>
        <CardLabel>{month}</CardLabel>
      </CardHeader>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <SelectField
          label="Category"
          value={categoryId}
          options={expenseCategories.map((category) => ({ value: category.id!, label: category.name }))}
          onChange={setCategoryId}
        />
        <CurrencyField label="Budget" value={amount} onChange={setAmount} />
        <Button type="button" onClick={() => void save()} disabled={!categoryId || amount <= 0}>Set budget</Button>
      </div>
      {error ? <p className="font-body text-caption text-loss">{error}</p> : null}
      {progress.length === 0 ? (
        <p className="font-body text-body-md text-foreground-muted">No budgets set for this month.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {progress.map((item) => {
            const width = Math.min(item.ratio * 100, 100);
            const barColor = item.status === 'overspent' ? 'bg-loss' : item.status === 'nearLimit' ? 'bg-warning' : 'bg-gain';
            return (
              <div key={item.categoryId ?? 'uncategorised'} className="rounded-md bg-surface-muted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-body-md text-foreground">{item.label}</p>
                    <p className="font-body text-caption text-foreground-muted">{item.status === 'overspent' ? 'Overspent' : item.status === 'nearLimit' ? 'Near limit' : 'On track'}</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => item.budgetId && void onDelete(item.budgetId)}>
                    Clear
                  </Button>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={Math.round(item.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.label} budget progress`}>
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${width}%` }} />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <Amount value={item.actual} />
                  <span className="font-body text-caption text-foreground-muted">of <Amount value={item.budget} /></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
