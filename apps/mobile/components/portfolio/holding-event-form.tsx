import { EVENT_KIND_LABELS, allowedEventKinds, fxRateToInrForCurrency } from '@finmanager/core';
import type { Holding, HoldingEvent, HoldingEventKind } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AmountKeypad } from '../expenses/amount-keypad';
import { Card, CardTitle } from '../card';
import { Choice } from '../choice';
import { Field } from '../field';

export function MobileHoldingEventForm({
  holding,
  onSave,
}: {
  readonly holding: Holding;
  readonly onSave: (event: HoldingEvent) => Promise<void>;
}) {
  const kinds = allowedEventKinds(holding.type);
  const [kind, setKind] = useState<HoldingEventKind>(kinds[0]!);
  const [amount, setAmount] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fxRate, setFxRate] = useState(
    String(holding.manualFxRateToInr ?? holding.automaticPriceFxRateToInr ?? 1),
  );
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
      setAmount('');
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the event');
    }
  }
  return (
    <Card>
      <CardTitle>Add event</CardTitle>
      <View className="mt-3 gap-3">
        {!detailsOpen ? (
          <>
            <Text className="text-center font-display text-display-md text-foreground">
              {holding.currency} {amount || '0'}
            </Text>
            <AmountKeypad
              value={amount}
              onChange={setAmount}
              onSubmit={() => setDetailsOpen(true)}
            />
          </>
        ) : (
          <>
            <Choice
              label="Event kind"
              value={kind}
              options={kinds.map((value) => ({ value, label: EVENT_KIND_LABELS[value] }))}
              onChange={setKind}
            />
            <Text className="font-body text-body-md text-foreground-muted">
              Amount: {holding.currency} {amount || '0'}
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
              <View className="gap-3">
                <Field label="Date">
                  <TextInput
                    value={occurredOn}
                    onChangeText={setOccurredOn}
                    placeholder="YYYY-MM-DD"
                    className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                  />
                </Field>
                <Field label="Quantity">
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                  />
                </Field>
                <Field label="Price">
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                  />
                </Field>
              </View>
            ) : null}
            {error ? <Text className="text-caption text-loss">{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void submit()}
              className="rounded-md bg-primary px-4 py-3"
            >
              <Text className="text-center text-primary-foreground">Save event</Text>
            </Pressable>
          </>
        )}
      </View>
    </Card>
  );
}
