import { fxRateToInrForCurrency } from '@finmanager/core';
import type { Holding, Valuation } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { Choice } from '../choice';
import { Field } from '../field';

export function MobileValuationForm({
  holdings,
  onSave,
}: {
  readonly holdings: readonly Holding[];
  readonly onSave: (valuation: Valuation) => Promise<void>;
}) {
  const [holdingId, setHoldingId] = useState(holdings[0]?.id ?? '');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [fxRate, setFxRate] = useState('1');
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    try {
      await onSave({
        holdingId,
        asOf: new Date().toISOString().slice(0, 10),
        value: Number(value),
        currency: currency as Valuation['currency'],
        fxRateToInr: fxRateToInrForCurrency(currency, fxRate),
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
      <CardTitle>Manual valuation</CardTitle>
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
          <Field label="Value (₹)">
            <TextInput
              value={value}
              onChangeText={setValue}
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
              Save valuation
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
