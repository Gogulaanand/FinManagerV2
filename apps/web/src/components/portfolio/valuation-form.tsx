'use client';

import type { Holding, Valuation } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';

export function ValuationForm({
  holdings,
  onSave,
}: {
  readonly holdings: readonly Holding[];
  readonly onSave: (valuation: Valuation) => Promise<void>;
}) {
  const [holdingId, setHoldingId] = useState(holdings[0]?.id ?? '');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [fxRate, setFxRate] = useState('1');
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    try {
      await onSave({
        holdingId,
        asOf,
        value: Number(value),
        currency: currency as Valuation['currency'],
        fxRateToInr: Number(fxRate) || null,
        source: 'manual',
      });
      setValue('');
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the valuation');
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add manual valuation</CardTitle>
      </CardHeader>
      {holdings.length === 0 ? (
        <p className="font-body text-body-md text-foreground-muted">Add a holding first.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Holding">
              {(id) => (
                <select
                  id={id}
                  className="h-10 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
                  value={holdingId}
                  onChange={(event) => setHoldingId(event.target.value)}
                >
                  {holdings.map((holding) => (
                    <option key={holding.id} value={holding.id}>
                      {holding.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="As of">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={asOf}
                  onChange={(event) => setAsOf(event.target.value)}
                />
              )}
            </Field>
            <Field label="Value (₹)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              )}
            </Field>
            <Field label="Currency">
              {(id) => (
                <select
                  id={id}
                  className="h-10 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {['INR', 'USD', 'EUR', 'GBP'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="FX rate to INR" hint="Use the rate on the valuation date for non-INR">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="any"
                  value={fxRate}
                  onChange={(event) => setFxRate(event.target.value)}
                />
              )}
            </Field>
          </div>
          {error ? <p className="mt-3 font-body text-caption text-loss">{error}</p> : null}
          <Button className="mt-4" type="button" onClick={() => void submit()}>
            Save valuation
          </Button>
        </>
      )}
    </Card>
  );
}
