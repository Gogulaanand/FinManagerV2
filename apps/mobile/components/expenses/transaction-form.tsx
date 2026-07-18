import {
  RecurrenceFrequencySchema,
  TransactionSchema,
  type Account,
  type Category,
  type Transaction,
} from '@finmanager/schema';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { CheckField, Field, Segmented } from '../field';
import { Card, CardTitle } from '../card';
import { uuidv4 } from '@finmanager/sync';

import { AmountKeypad } from './amount-keypad';

export interface MobileTransactionFormProps {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly initialTransaction?: Transaction | null | undefined;
  readonly onSave: (transaction: Transaction) => Promise<void>;
  readonly onCancel: () => void;
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {options.map((option) => (
          <Text
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            className={`rounded-full px-3 py-2 font-body text-label ${option.value === value ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground'}`}
          >
            {option.label}
          </Text>
        ))}
      </ScrollView>
    </Field>
  );
}

export function MobileTransactionForm({
  accounts,
  categories,
  initialTransaction,
  onSave,
  onCancel,
}: MobileTransactionFormProps) {
  const expenseCategories = categories.filter((category) => category.kind === 'expense');
  const incomeCategories = categories.filter((category) => category.kind === 'income');
  const [amount, setAmount] = useState(
    initialTransaction?.amount ? String(initialTransaction.amount) : '',
  );
  const [direction, setDirection] = useState<'debit' | 'credit'>(
    initialTransaction?.direction ?? 'debit',
  );
  const [accountId, setAccountId] = useState(initialTransaction?.accountId ?? '');
  const [categoryId, setCategoryId] = useState(
    initialTransaction?.categoryId ?? expenseCategories[0]?.id ?? '',
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
      amount: Number.parseFloat(amount),
      direction,
      currency: 'INR',
      occurredOn,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
      isRecurring,
      recurringId: initialTransaction?.recurringId ?? (isRecurring ? uuidv4() : null),
      recurrenceFrequency: isRecurring ? frequency : null,
      recurrenceInterval: isRecurring ? interval : 1,
      recurrenceEndOn: isRecurring ? endOn || null : null,
      recurrenceGeneratedThrough: initialTransaction?.recurrenceGeneratedThrough ?? null,
      importHash: initialTransaction?.importHash ?? null,
      occurrenceKey: initialTransaction?.occurrenceKey ?? null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a positive amount and valid details');
      return;
    }
    setError(null);
    await onSave(parsed.data);
  }

  const categoryOptions = (direction === 'debit' ? expenseCategories : incomeCategories).map(
    (category) => ({ value: category.id!, label: category.name }),
  );
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 p-4 pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text className="font-display text-headline-lg text-foreground">
          {initialTransaction ? 'Edit expense' : 'New transaction'}
        </Text>
        <Text className="font-body text-body-md text-foreground-muted">
          Amount first. Details second.
        </Text>
      </View>
      <Card className="gap-4">
        <CardTitle>₹{amount || '0'}</CardTitle>
        <Segmented
          label="Type"
          value={direction}
          options={[
            { value: 'debit', label: 'Expense' },
            { value: 'credit', label: 'Income' },
          ]}
          onChange={(value) => {
            setDirection(value);
            setCategoryId('');
          }}
        />
        <AmountKeypad value={amount} onChange={setAmount} onSubmit={() => void submit()} />
      </Card>
      <Card className="gap-4">
        <CardTitle>Details</CardTitle>
        <ChoiceRow
          label="Category"
          value={categoryId}
          options={categoryOptions}
          onChange={setCategoryId}
        />
        <ChoiceRow
          label="Account"
          value={accountId}
          options={accounts.map((account) => ({ value: account.id!, label: account.name }))}
          onChange={setAccountId}
        />
        <Field label="Date">
          <TextInput
            value={occurredOn}
            onChangeText={setOccurredOn}
            placeholder="YYYY-MM-DD"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Merchant">
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. Swiggy"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Note">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <CheckField
          label="Repeat this transaction"
          checked={isRecurring}
          onChange={setIsRecurring}
        />
        {isRecurring ? (
          <View className="gap-3">
            <Segmented
              label="Repeats"
              value={frequency}
              options={RecurrenceFrequencySchema.options.map((value) => ({
                value,
                label: value[0]!.toUpperCase() + value.slice(1),
              }))}
              onChange={setFrequency}
            />
            <Field label="Every">
              <TextInput
                value={String(interval)}
                onChangeText={(value) => setInterval(Number.parseInt(value, 10) || 1)}
                keyboardType="number-pad"
                className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              />
            </Field>
            <Field label="Ends on">
              <TextInput
                value={endOn}
                onChangeText={setEndOn}
                placeholder="Optional YYYY-MM-DD"
                className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              />
            </Field>
          </View>
        ) : null}
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <View className="flex-row gap-2">
          <Text
            onPress={onCancel}
            accessibilityRole="button"
            className="flex-1 rounded-md bg-surface-muted py-3 text-center font-body text-body-md text-foreground"
          >
            Cancel
          </Text>
          <Text
            onPress={() => void submit()}
            accessibilityRole="button"
            className="flex-1 rounded-md bg-primary py-3 text-center font-body text-body-md text-primary-foreground"
          >
            Save
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
