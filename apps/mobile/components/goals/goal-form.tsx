import type { Goal, GoalKind, Holding } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { Choice } from '../choice';
import { CheckField, CurrencyField, Field } from '../field';

const KINDS: readonly { value: GoalKind; label: string }[] = [
  { value: 'education', label: 'Education' },
  { value: 'foreign_studies', label: 'Foreign' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'custom', label: 'Custom' },
];

const TEMPLATE_RATES: Record<GoalKind, { expectedReturn: number; inflation: number }> = {
  education: { expectedReturn: 12, inflation: 10 },
  foreign_studies: { expectedReturn: 12, inflation: 8 },
  marriage: { expectedReturn: 11, inflation: 7 },
  retirement: { expectedReturn: 11, inflation: 6 },
  custom: { expectedReturn: 12, inflation: 6 },
};

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const inputClass =
  'h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground';

export function MobileGoalForm({
  initial = null,
  holdings,
  onSave,
  onCancel,
}: {
  readonly initial?: Goal | null;
  readonly holdings: readonly Holding[];
  readonly onSave: (goal: Goal) => Promise<void>;
  readonly onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<GoalKind>(initial?.kind ?? 'education');
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount ?? 0);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [currentAmount, setCurrentAmount] = useState(initial?.currentAmount ?? 0);
  const [expectedReturn, setExpectedReturn] = useState(
    String(initial?.expectedReturn ?? TEMPLATE_RATES[initial?.kind ?? 'education'].expectedReturn),
  );
  const [inflation, setInflation] = useState(
    String(initial?.inflation ?? TEMPLATE_RATES[initial?.kind ?? 'education'].inflation),
  );
  const [linked, setLinked] = useState<readonly string[]>(initial?.linkedHoldingIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  function changeKind(next: GoalKind) {
    setKind(next);
    if (!initial) {
      setExpectedReturn(String(TEMPLATE_RATES[next].expectedReturn));
      setInflation(String(TEMPLATE_RATES[next].inflation));
    }
  }

  function toggleLinked(id: string, checked: boolean) {
    setLinked((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  }

  async function submit() {
    try {
      await onSave({
        id: initial?.id,
        userId: initial?.userId,
        name,
        kind,
        targetAmount,
        targetDate: targetDate.trim() || null,
        currentAmount,
        expectedReturn: numberOrNull(expectedReturn),
        inflation: numberOrNull(inflation),
        linkedHoldingIds: linked as string[],
        notes: notes.trim() || null,
      });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the goal details');
    }
  }

  return (
    <Card>
      <CardTitle>{initial ? 'Edit goal' : 'Add goal'}</CardTitle>
      <View className="mt-3 gap-3">
        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Daughter's college"
            className={inputClass}
          />
        </Field>
        <Choice label="Goal type" value={kind} options={KINDS} onChange={changeKind} />
        <CurrencyField
          label="Target amount (today's ₹)"
          value={targetAmount}
          onChange={setTargetAmount}
          hint="The engine inflates this to the target date"
        />
        <Field label="Target date (YYYY-MM-DD)">
          <TextInput
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="2035-06-01"
            autoCapitalize="none"
            className={inputClass}
          />
        </Field>
        <CurrencyField
          label="Already saved (₹)"
          value={currentAmount}
          onChange={setCurrentAmount}
          hint="Money set aside outside of linked holdings"
        />
        <Field label="Expected return (% p.a.)">
          <TextInput
            value={expectedReturn}
            onChangeText={setExpectedReturn}
            keyboardType="decimal-pad"
            className={inputClass}
          />
        </Field>
        <Field label="Inflation (% p.a.)">
          <TextInput
            value={inflation}
            onChangeText={setInflation}
            keyboardType="decimal-pad"
            className={inputClass}
          />
        </Field>
        <Field label="Notes (optional)">
          <TextInput value={notes} onChangeText={setNotes} className={inputClass} />
        </Field>
        {holdings.length > 0 ? (
          <Field label="Link holdings that fund this goal">
            <View className="gap-1">
              {holdings.map((holding) => (
                <CheckField
                  key={holding.id}
                  label={`${holding.name} (${holding.type.replace('_', ' ')})`}
                  checked={holding.id ? linked.includes(holding.id) : false}
                  onChange={(checked) => holding.id && toggleLinked(holding.id, checked)}
                />
              ))}
            </View>
          </Field>
        ) : null}
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <View className="flex-row gap-2">
          {onCancel ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              className="flex-1 rounded-md bg-surface-muted px-4 py-3"
            >
              <Text className="text-center font-body text-label text-foreground">Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void submit()}
            className="flex-1 rounded-md bg-primary px-4 py-3 active:opacity-80"
          >
            <Text className="text-center font-body text-label text-primary-foreground">
              {initial ? 'Save changes' : 'Add goal'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
