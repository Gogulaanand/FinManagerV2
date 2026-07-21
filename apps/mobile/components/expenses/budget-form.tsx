import { BudgetSchema, type Budget, type Category } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Card } from '../card';
import { Field } from '../field';

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

export function MobileBudgetForm({
  month,
  categories,
  existing,
  onSave,
  onCancel,
}: {
  month: string;
  categories: readonly Category[];
  existing: readonly { categoryId: string | null; budgetId: string | null }[];
  onSave: (budget: Budget) => Promise<void>;
  onCancel: () => void;
}) {
  const expenseCategories = categories.filter((category) => category.kind === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    const parsed = BudgetSchema.safeParse({
      categoryId: categoryId || null,
      period: 'monthly',
      periodStart: `${month}-01`,
      amount: Number.parseFloat(amount),
      id: existing.find((item) => item.categoryId === (categoryId || null))?.budgetId ?? undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a positive budget');
      return;
    }
    setError(null);
    await onSave(parsed.data);
  }
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-12">
      <View>
        <Text className="font-display text-headline-lg text-foreground">Set monthly budget</Text>
        <Text className="font-body text-body-md text-foreground-muted">{month}</Text>
      </View>
      <Card className="gap-4">
        <ChoiceRow
          label="Category"
          value={categoryId}
          options={expenseCategories.map((category) => ({
            value: category.id!,
            label: category.name,
          }))}
          onChange={setCategoryId}
        />
        <Field label="Budget">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="₹ amount"
            keyboardType="decimal-pad"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            className="flex-1 rounded-md bg-surface-muted py-3"
          >
            <Text className="text-center text-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void submit()}
            className="flex-1 rounded-md bg-primary py-3"
          >
            <Text className="text-center text-primary-foreground">Save</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}
