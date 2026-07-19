'use client';

import type { Goal, GoalKind, Holding } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckField, CurrencyField, Field, Input, SelectField } from '@/components/ui/input';

const KINDS: readonly { value: GoalKind; label: string }[] = [
  { value: 'education', label: 'Child education' },
  { value: 'foreign_studies', label: 'Foreign studies' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'custom', label: 'Custom' },
];

/** Sensible starting return/inflation assumptions per goal template (whole %). */
const TEMPLATE_RATES: Record<GoalKind, { expectedReturn: number; inflation: number }> = {
  education: { expectedReturn: 12, inflation: 10 },
  foreign_studies: { expectedReturn: 12, inflation: 8 },
  marriage: { expectedReturn: 11, inflation: 7 },
  retirement: { expectedReturn: 11, inflation: 6 },
  custom: { expectedReturn: 12, inflation: 6 },
};

interface GoalFormProps {
  readonly initial?: Goal | null;
  readonly holdings: readonly Holding[];
  readonly onSave: (goal: Goal) => Promise<void>;
  readonly onCancel?: () => void;
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function GoalForm({ initial = null, holdings, onSave, onCancel }: GoalFormProps) {
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
    // Prefill assumptions from the template only when the user has not set them.
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
        targetDate: targetDate || null,
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
      <CardHeader>
        <CardTitle>{initial ? 'Edit goal' : 'Add goal'}</CardTitle>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Daughter's college"
            />
          )}
        </Field>
        <SelectField label="Goal type" value={kind} options={KINDS} onChange={changeKind} />
        <CurrencyField
          label="Target amount (today's ₹)"
          value={targetAmount}
          onChange={setTargetAmount}
          hint="The engine inflates this to the target date"
        />
        <Field label="Target date">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          )}
        </Field>
        <CurrencyField
          label="Already saved (₹)"
          value={currentAmount}
          onChange={setCurrentAmount}
          hint="Money set aside outside of linked holdings"
        />
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
        <Field label="Notes">
          {(id) => (
            <Input id={id} value={notes} onChange={(event) => setNotes(event.target.value)} />
          )}
        </Field>
      </div>
      {holdings.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 font-body text-label text-foreground-muted">
            Link holdings that fund this goal
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {holdings.map((holding) => (
              <CheckField
                key={holding.id}
                label={`${holding.name} (${holding.type.replace('_', ' ')})`}
                checked={holding.id ? linked.includes(holding.id) : false}
                onChange={(checked) => holding.id && toggleLinked(holding.id, checked)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 font-body text-caption text-loss">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={() => void submit()}>
          {initial ? 'Save changes' : 'Add goal'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
