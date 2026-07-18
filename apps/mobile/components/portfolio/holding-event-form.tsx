import { formatChoiceLabel, fxRateToInrForCurrency } from '@finmanager/core';
import type { Holding, HoldingEvent, HoldingEventKind } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { Choice } from '../choice';
import { Field } from '../field';

const kinds: readonly HoldingEventKind[] = [
  'buy',
  'sell',
  'vest',
  'exercise',
  'dividend',
  'interest',
  'contribution',
  'withdrawal',
];

export function MobileHoldingEventForm({
  holdings,
  onSave,
}: {
  readonly holdings: readonly Holding[];
  readonly onSave: (event: HoldingEvent) => Promise<void>;
}) {
  const [holdingId, setHoldingId] = useState(holdings[0]?.id ?? '');
  const [kind, setKind] = useState<HoldingEventKind>('buy');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [fxRate, setFxRate] = useState('1');
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    const absolute = Math.abs(Number(amount) || 0);
    const signed = ['buy', 'contribution', 'exercise'].includes(kind)
      ? -absolute
      : kind === 'vest'
        ? 0
        : absolute;
    try {
      await onSave({
        holdingId,
        kind,
        occurredOn: new Date().toISOString().slice(0, 10),
        quantity: null,
        price: null,
        amount: signed,
        currency: currency as HoldingEvent['currency'],
        fxRateToInr: fxRateToInrForCurrency(currency, fxRate),
        note: null,
        importHash: null,
      });
      setAmount('');
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the event');
    }
  }
  return (
    <Card>
      <CardTitle>Add event</CardTitle>
      {holdings.length === 0 ? (
        <Text className="mt-3 font-body text-body-md text-foreground-muted">
          Add a holding first.
        </Text>
      ) : (
        <View className="mt-3 gap-3">
          <Choice
            label="Holding"
            value={holdingId}
            options={holdings.map((holding) => ({ value: holding.id!, label: holding.name }))}
            onChange={setHoldingId}
          />
          <Choice
            label="Event kind"
            value={kind}
            options={kinds.map((value) => ({ value, label: formatChoiceLabel(value) }))}
            onChange={setKind}
            hint={kinds.map(formatChoiceLabel).join(' · ')}
          />
          <Field label="Amount (₹)">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
            />
          </Field>
          <Choice
            label="Currency"
            value={currency}
            options={['INR', 'USD', 'EUR', 'GBP'].map((value) => ({ value, label: value }))}
            onChange={setCurrency}
            hint="INR, USD, EUR, or GBP"
          />
          {currency !== 'INR' ? (
            <Field label="FX rate to INR">
              <TextInput
                value={fxRate}
                onChangeText={setFxRate}
                keyboardType="decimal-pad"
                className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              />
            </Field>
          ) : null}
          {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void submit()}
            className="rounded-md bg-primary px-4 py-3"
          >
            <Text className="text-center font-body text-label text-primary-foreground">
              Save event
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
