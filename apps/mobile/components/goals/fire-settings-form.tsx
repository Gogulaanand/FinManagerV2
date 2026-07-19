import type { FireSettings } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { CurrencyField, Field } from '../field';

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

const inputClass =
  'h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground';

export function MobileFireSettingsForm({
  initial,
  onSave,
}: {
  readonly initial: FireSettings;
  readonly onSave: (settings: FireSettings) => Promise<void>;
}) {
  // Collected and shown as a monthly figure; stored as annual (×12).
  const [monthlyExpenses, setMonthlyExpenses] = useState(
    initial.annualExpenses ? Math.round(initial.annualExpenses / 12) : 0,
  );
  const [withdrawalRate, setWithdrawalRate] = useState(String(initial.withdrawalRate));
  const [expectedReturn, setExpectedReturn] = useState(String(initial.expectedReturn ?? 10));
  const [inflation, setInflation] = useState(String(initial.inflation ?? 6));
  const [currentAge, setCurrentAge] = useState(String(initial.currentAge ?? ''));
  const [retirementAge, setRetirementAge] = useState(String(initial.retirementAge ?? ''));
  const [leanMultiplier, setLeanMultiplier] = useState(String(initial.leanMultiplier ?? 0.7));
  const [fatMultiplier, setFatMultiplier] = useState(String(initial.fatMultiplier ?? 1.5));
  const [monthlyInvestment, setMonthlyInvestment] = useState(
    initial.monthlyInvestment ? Math.round(initial.monthlyInvestment) : 0,
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      await onSave({
        id: initial.id,
        userId: initial.userId,
        annualExpenses: monthlyExpenses > 0 ? monthlyExpenses * 12 : null,
        withdrawalRate: numberOrNull(withdrawalRate) ?? 4,
        expectedReturn: numberOrNull(expectedReturn),
        inflation: numberOrNull(inflation),
        currentAge: intOrNull(currentAge),
        retirementAge: intOrNull(retirementAge),
        leanMultiplier: numberOrNull(leanMultiplier),
        fatMultiplier: numberOrNull(fatMultiplier),
        monthlyInvestment: monthlyInvestment > 0 ? monthlyInvestment : null,
      });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the FIRE inputs');
    }
  }

  return (
    <Card>
      <CardTitle>FIRE settings</CardTitle>
      <View className="mt-3 gap-3">
        <CurrencyField
          label="Monthly expenses (₹)"
          value={monthlyExpenses}
          onChange={(value) => setMonthlyExpenses(value)}
          hint="Auto-suggested from recent spend; annualised (×12) for FIRE"
        />
        <CurrencyField
          label="Monthly investment (₹)"
          value={monthlyInvestment}
          onChange={(value) => setMonthlyInvestment(value)}
          hint="Invested each month toward FIRE. Leave 0 to derive it from income minus expenses"
        />
        <Field label="Withdrawal rate (%)" hint="4% is the common safe rule (25x expenses)">
          <TextInput
            value={withdrawalRate}
            onChangeText={setWithdrawalRate}
            keyboardType="decimal-pad"
            className={inputClass}
          />
        </Field>
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
        <Field label="Current age">
          <TextInput
            value={currentAge}
            onChangeText={setCurrentAge}
            keyboardType="number-pad"
            className={inputClass}
          />
        </Field>
        <Field label="Target retirement age">
          <TextInput
            value={retirementAge}
            onChangeText={setRetirementAge}
            keyboardType="number-pad"
            className={inputClass}
          />
        </Field>
        <Field
          label="Lean multiplier"
          hint="Below 1 - a leaner target than the regular number (e.g. 0.7)"
        >
          <TextInput
            value={leanMultiplier}
            onChangeText={setLeanMultiplier}
            keyboardType="decimal-pad"
            className={inputClass}
          />
        </Field>
        <Field label="Fat multiplier" hint="Fat FIRE corpus vs the regular number">
          <TextInput
            value={fatMultiplier}
            onChangeText={setFatMultiplier}
            keyboardType="decimal-pad"
            className={inputClass}
          />
        </Field>
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void submit()}
          className="rounded-md bg-primary px-4 py-3 active:opacity-80"
        >
          <Text className="text-center font-body text-label text-primary-foreground">
            Save FIRE settings
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
