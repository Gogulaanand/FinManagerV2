'use client';

import type { FireSettings } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyField, Field, Input } from '@/components/ui/input';

interface FireSettingsFormProps {
  readonly initial: FireSettings;
  readonly onSave: (settings: FireSettings) => Promise<void>;
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export function FireSettingsForm({ initial, onSave }: FireSettingsFormProps) {
  // Collected and shown as a monthly figure; stored as annual (×12).
  const [monthlyExpenses, setMonthlyExpenses] = useState(
    initial.annualExpenses ? Math.round(initial.annualExpenses / 12) : 0,
  );
  const [investableCorpus, setInvestableCorpus] = useState(String(initial.investableCorpus ?? ''));
  const [confirmed, setConfirmed] = useState(initial.expensesConfirmed);
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
      if (!confirmed || monthlyExpenses <= 0)
        throw new Error('Confirm a positive expense baseline before saving.');
      const corpus = investableCorpus.trim() ? Number(investableCorpus) : NaN;
      if (!Number.isFinite(corpus) || corpus < 0)
        throw new Error('Enter an investable corpus, including 0 if none.');
      await onSave({
        investableCorpus: corpus,
        expensesConfirmed: true,
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
      <CardHeader>
        <CardTitle>FIRE settings</CardTitle>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Investable FIRE corpus (₹)"
          hint="Exclude your occupied home, emergency reserve, inaccessible funds and money committed to other goals. Net worth is shown separately."
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="any"
              value={investableCorpus}
              onChange={(event) => setInvestableCorpus(event.target.value)}
            />
          )}
        </Field>
        <label className="font-body text-body-md text-foreground">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{' '}
          I have reviewed and confirm the expense baseline
        </label>
        <CurrencyField
          label="Monthly expenses (₹)"
          value={monthlyExpenses}
          onChange={(value) => {
            setMonthlyExpenses(value);
            setConfirmed(false);
          }}
          hint="Review essential and irregular expenses; saving confirms this monthly baseline (×12 annually)."
        />
        <CurrencyField
          label="Monthly investment (₹)"
          value={monthlyInvestment}
          onChange={(value) => setMonthlyInvestment(value)}
          hint="How much you invest each month toward FIRE. Leave 0 to derive it from your recent income minus expenses"
        />
        <Field label="Withdrawal rate (%)" hint="4% is the common safe rule (25x expenses)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="100"
              step="any"
              value={withdrawalRate}
              onChange={(event) => setWithdrawalRate(event.target.value)}
            />
          )}
        </Field>
        <Field label="Expected return (% p.a.)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="100"
              step="any"
              value={expectedReturn}
              onChange={(event) => setExpectedReturn(event.target.value)}
            />
          )}
        </Field>
        <Field label="Inflation (% p.a.)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="100"
              step="any"
              value={inflation}
              onChange={(event) => setInflation(event.target.value)}
            />
          )}
        </Field>
        <Field label="Current age">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="120"
              value={currentAge}
              onChange={(event) => setCurrentAge(event.target.value)}
            />
          )}
        </Field>
        <Field label="Target retirement age">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="120"
              value={retirementAge}
              onChange={(event) => setRetirementAge(event.target.value)}
            />
          )}
        </Field>
        <Field
          label="Lean multiplier"
          hint="Below 1 - a leaner target than the regular number (e.g. 0.7)"
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="0.99"
              step="any"
              value={leanMultiplier}
              onChange={(event) => setLeanMultiplier(event.target.value)}
            />
          )}
        </Field>
        <Field label="Fat multiplier" hint="Fat FIRE corpus vs the regular number">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="any"
              value={fatMultiplier}
              onChange={(event) => setFatMultiplier(event.target.value)}
            />
          )}
        </Field>
      </div>
      {error ? <p className="mt-3 font-body text-caption text-loss">{error}</p> : null}
      <div className="mt-4">
        <Button type="button" onClick={() => void submit()}>
          Save FIRE settings
        </Button>
      </div>
    </Card>
  );
}
