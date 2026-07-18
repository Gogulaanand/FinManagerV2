'use client';

import type { Holding, HoldingEvent, HoldingEventKind } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';

const KINDS: readonly HoldingEventKind[] = [
  'buy',
  'sell',
  'vest',
  'exercise',
  'dividend',
  'interest',
  'contribution',
  'withdrawal',
];

export function HoldingEventForm({
  holdings,
  onSave,
}: {
  readonly holdings: readonly Holding[];
  readonly onSave: (event: HoldingEvent) => Promise<void>;
}) {
  const [holdingId, setHoldingId] = useState(holdings[0]?.id ?? '');
  const [kind, setKind] = useState<HoldingEventKind>('buy');
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [fxRate, setFxRate] = useState('1');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const absolute = Math.abs(Number.parseFloat(amount) || 0);
    const signed = ['buy', 'contribution', 'exercise'].includes(kind)
      ? -absolute
      : kind === 'vest'
        ? 0
        : absolute;
    try {
      await onSave({
        holdingId,
        kind,
        occurredOn,
        quantity: quantity ? Number(quantity) : null,
        price: price ? Number(price) : null,
        amount: signed,
        currency: currency as HoldingEvent['currency'],
        fxRateToInr: Number(fxRate) || null,
        note: null,
        importHash: null,
      });
      setError(null);
      setAmount('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the event details');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add cash-flow event</CardTitle>
      </CardHeader>
      {holdings.length === 0 ? (
        <p className="font-body text-body-md text-foreground-muted">Add a holding first.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
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
            <Field label="Event type">
              {(id) => (
                <select
                  id={id}
                  className="h-10 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as HoldingEventKind)}
                >
                  {KINDS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={occurredOn}
                  onChange={(event) => setOccurredOn(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Amount (₹)"
              hint={
                kind === 'vest' ? 'Vest is recorded as non-cash here' : 'Enter an absolute amount'
              }
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              )}
            </Field>
            <Field label="Quantity (optional)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              )}
            </Field>
            <Field label="Price (optional)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
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
            <Field label="FX rate to INR" hint="Use the rate on the event date for non-INR">
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
            Add event
          </Button>
        </>
      )}
    </Card>
  );
}
