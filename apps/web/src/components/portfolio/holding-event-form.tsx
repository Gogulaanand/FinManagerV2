'use client';

import {
  EVENT_KIND_LABELS,
  allowedEventKinds,
  fxRateToInrForCurrency,
  showsQuantityPrice,
} from '@finmanager/core';
import type { Holding, HoldingEvent, HoldingEventKind } from '@finmanager/schema';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyField, Field, Input, SelectField } from '@/components/ui/input';

export function HoldingEventForm({
  holding,
  onSave,
}: {
  readonly holding: Holding;
  readonly onSave: (event: HoldingEvent) => Promise<void>;
}) {
  const kinds = allowedEventKinds(holding.type);
  const [kind, setKind] = useState<HoldingEventKind>(kinds[0]!);
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fxRate, setFxRate] = useState(
    String(holding.manualFxRateToInr ?? holding.automaticPriceFxRateToInr ?? 1),
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quantityFields = (
    <>
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
    </>
  );

  async function submit() {
    const absolute = Math.abs(amount);
    const signed = ['buy', 'contribution', 'exercise'].includes(kind)
      ? -absolute
      : kind === 'vest'
        ? 0
        : absolute;
    try {
      await onSave({
        holdingId: holding.id!,
        kind,
        occurredOn,
        quantity: quantity ? Number(quantity) : null,
        price: price ? Number(price) : null,
        amount: signed,
        currency: holding.currency,
        fxRateToInr: fxRateToInrForCurrency(holding.currency, fxRate),
        note: null,
        importHash: null,
      });
      setAmount(0);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the event details');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add event</CardTitle>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Kind"
          value={kind}
          options={kinds.map((value) => ({ value, label: EVENT_KIND_LABELS[value] }))}
          onChange={setKind}
        />
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
        <CurrencyField
          label="Amount"
          value={amount}
          onChange={setAmount}
          hint={kind === 'vest' ? 'Shares vested is a non-cash event' : undefined}
        />
        {showsQuantityPrice(holding.type) ? quantityFields : null}
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
      {!showsQuantityPrice(holding.type) ? (
        <div className="mt-4">
          <Button type="button" variant="ghost" onClick={() => setMoreOpen((open) => !open)}>
            More options
          </Button>
          {moreOpen ? <div className="mt-3 grid gap-4 md:grid-cols-2">{quantityFields}</div> : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-caption text-loss">{error}</p> : null}
      <Button className="mt-4" type="button" onClick={() => void submit()}>
        Add event
      </Button>
    </Card>
  );
}
