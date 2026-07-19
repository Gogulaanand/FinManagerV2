import { fxRateToInrForCurrency } from '@finmanager/core';
import type { Holding, Valuation } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { AmountKeypad } from '../expenses/amount-keypad';
import { Field } from '../field';

export function MobileValuationForm({
  holding,
  onSave,
}: {
  readonly holding: Holding;
  readonly onSave: (valuation: Valuation) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [fxRate, setFxRate] = useState(
    String(holding.manualFxRateToInr ?? holding.automaticPriceFxRateToInr ?? 1),
  );
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    try {
      await onSave({
        holdingId: holding.id!,
        asOf,
        value: Number(value),
        currency: holding.currency,
        fxRateToInr: fxRateToInrForCurrency(holding.currency, fxRate),
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
      <CardTitle>Update value</CardTitle>
      <View className="mt-3 gap-3">
        {!detailsOpen ? (
          <>
            <Text className="text-center font-display text-display-md text-foreground">
              {holding.currency} {value || '0'}
            </Text>
            <AmountKeypad value={value} onChange={setValue} onSubmit={() => setDetailsOpen(true)} />
          </>
        ) : (
          <>
            <Text className="font-body text-body-md text-foreground-muted">
              Value: {holding.currency} {value || '0'}
            </Text>
            {holding.currency !== 'INR' ? (
              <Field label="FX rate to INR">
                <TextInput
                  value={fxRate}
                  onChangeText={setFxRate}
                  keyboardType="decimal-pad"
                  className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                />
              </Field>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: moreOpen }}
              onPress={() => setMoreOpen((open) => !open)}
              className="rounded-md bg-surface-muted px-3 py-3"
            >
              <Text className="text-foreground">More options</Text>
            </Pressable>
            {moreOpen ? (
              <Field label="As of date">
                <TextInput
                  value={asOf}
                  onChangeText={setAsOf}
                  placeholder="YYYY-MM-DD"
                  className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                />
              </Field>
            ) : null}
            {error ? <Text className="text-caption text-loss">{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void submit()}
              className="rounded-md bg-primary px-4 py-3"
            >
              <Text className="text-center text-primary-foreground">Update value</Text>
            </Pressable>
          </>
        )}
      </View>
    </Card>
  );
}
