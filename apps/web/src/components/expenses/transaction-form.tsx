'use client';

import {
  RecurrenceFrequencySchema,
  TransactionSchema,
  type Account,
  type Category,
  type Transaction,
} from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { CurrencyField, Input, SelectField } from '@/components/ui/input';

const directionOptions = [
  { value: 'debit', label: 'Expense' },
  { value: 'credit', label: 'Income' },
] as const;

const frequencyOptions = RecurrenceFrequencySchema.options.map((value) => ({
  value,
  label: value[0]!.toUpperCase() + value.slice(1),
}));

export interface TransactionFormProps {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly initialTransaction?: Transaction | null | undefined;
  readonly onSave: (transaction: Transaction) => Promise<void>;
  readonly onCancel?: (() => void) | undefined;
}

export function TransactionForm({
  accounts,
  categories,
  initialTransaction,
  onSave,
  onCancel,
}: TransactionFormProps) {
  const firstExpense = categories.find((category) => category.kind === 'expense');
  const [amount, setAmount] = useState(initialTransaction?.amount ?? 0);
  const [direction, setDirection] = useState<'debit' | 'credit'>(
    initialTransaction?.direction ?? 'debit',
  );
  const [accountId, setAccountId] = useState(initialTransaction?.accountId ?? '');
  const [categoryId, setCategoryId] = useState(
    initialTransaction?.categoryId ?? firstExpense?.id ?? '',
  );
  const [occurredOn, setOccurredOn] = useState(
    initialTransaction?.occurredOn ?? new Date().toISOString().slice(0, 10),
  );
  const [merchant, setMerchant] = useState(initialTransaction?.merchant ?? '');
  const [note, setNote] = useState(initialTransaction?.note ?? '');
  const [isRecurring, setIsRecurring] = useState(initialTransaction?.isRecurring ?? false);
  const [frequency, setFrequency] = useState(initialTransaction?.recurrenceFrequency ?? 'monthly');
  const [interval, setInterval] = useState(initialTransaction?.recurrenceInterval ?? 1);
  const [endOn, setEndOn] = useState(initialTransaction?.recurrenceEndOn ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = TransactionSchema.safeParse({
      id: initialTransaction?.id,
      userId: initialTransaction?.userId,
      accountId: accountId || null,
      categoryId: categoryId || null,
      amount,
      direction,
      currency: 'INR',
      occurredOn,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
      isRecurring,
      recurringId: initialTransaction?.recurringId ?? (isRecurring ? crypto.randomUUID() : null),
      recurrenceFrequency: isRecurring ? frequency : null,
      recurrenceInterval: isRecurring ? interval : 1,
      recurrenceEndOn: isRecurring ? endOn || null : null,
      recurrenceGeneratedThrough: initialTransaction?.recurrenceGeneratedThrough ?? null,
      importHash: initialTransaction?.importHash ?? null,
      occurrenceKey: initialTransaction?.occurrenceKey ?? null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter valid transaction details');
      return;
    }
    setError(null);
    await onSave(parsed.data);
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>{initialTransaction ? 'Edit transaction' : 'Add transaction'}</CardTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyField label="Amount" value={amount} onChange={setAmount} />
        <SelectField
          label="Type"
          value={direction}
          options={directionOptions}
          onChange={(next) => {
            setDirection(next);
            setCategoryId(
              categories.find(
                (category) => category.kind === (next === 'debit' ? 'expense' : 'income'),
              )?.id ?? '',
            );
          }}
        />
        <SelectField
          label="Account"
          value={accountId}
          options={[
            { value: '', label: 'No account' },
            ...accounts.map((account) => ({ value: account.id!, label: account.name })),
          ]}
          onChange={setAccountId}
        />
        <SelectField
          label="Category"
          value={categoryId}
          options={[
            { value: '', label: 'Uncategorised' },
            ...categories
              .filter(
                (category) => category.kind === (direction === 'debit' ? 'expense' : 'income'),
              )
              .map((category) => ({ value: category.id!, label: category.name })),
          ]}
          onChange={setCategoryId}
        />
        <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
          Date
          <Input
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
          Merchant
          <Input
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="e.g. Swiggy"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
        Note
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note"
        />
      </label>
      <label className="flex items-center gap-2 font-body text-body-md text-foreground">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(event) => setIsRecurring(event.target.checked)}
        />
        Repeat this transaction
      </label>
      {isRecurring ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Repeats"
            value={frequency}
            options={frequencyOptions}
            onChange={setFrequency}
          />
          <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
            Every
            <Input
              type="number"
              min={1}
              step={1}
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1.5 font-body text-label text-foreground-muted">
            Ends on
            <Input type="date" value={endOn} onChange={(event) => setEndOn(event.target.value)} />
          </label>
        </div>
      ) : null}
      {error ? <p className="font-body text-caption text-loss">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" onClick={() => void submit()} disabled={amount <= 0}>
          Save transaction
        </Button>
      </div>
    </Card>
  );
}
