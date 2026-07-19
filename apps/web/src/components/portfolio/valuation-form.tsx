'use client';

import { fxRateToInrForCurrency } from '@finmanager/core';
import type { Holding, Valuation } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyField, Field, Input } from '@/components/ui/input';

export function ValuationForm({
  holding,
  onSave,
}: {
  readonly holding: Holding;
  readonly onSave: (valuation: Valuation) => Promise<void>;
}) {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState(0);
  const [fxRate, setFxRate] = useState(
    String(holding.manualFxRateToInr ?? holding.automaticPriceFxRateToInr ?? 1),
  );
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    try {
      await onSave({
        holdingId: holding.id!,
        asOf,
        value,
        currency: holding.currency,
        fxRateToInr: fxRateToInrForCurrency(holding.currency, fxRate),
        source: 'manual',
      });
      setValue(0);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the valuation');
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Update value</CardTitle>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <CurrencyField label="Value" value={value} onChange={setValue} />
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
        {holding.currency !== 'INR' ? (
          <>
            <Field label="Currency">
              {(id) => <Input id={id} value={holding.currency} disabled />}
            </Field>
            <Field label="FX rate to INR">
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
          </>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-caption text-loss">{error}</p> : null}
      <Button className="mt-4" type="button" onClick={() => void submit()}>
        Update value
      </Button>
    </Card>
  );
}
