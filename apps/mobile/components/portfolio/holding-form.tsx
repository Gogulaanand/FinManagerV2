import {
  HoldingMetadataSchema,
  type Holding,
  type HoldingMetadata,
  type HoldingType,
} from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { Field } from '../field';

function metadataFor(
  type: HoldingType,
  name: string,
  quantity: number,
  avgCost: number | null,
  existing: HoldingMetadata | null,
): HoldingMetadata | null {
  if (existing && existing.kind === type) return existing;
  if (type === 'rsu' || type === 'esop')
    return {
      kind: type,
      grantDate: new Date().toISOString().slice(0, 10),
      grantPrice: avgCost ?? 0,
      sourceCurrency: 'USD',
      vestSchedule: [
        {
          date: new Date().toISOString().slice(0, 10),
          quantity: Math.max(quantity, 0.000001),
          vested: true,
        },
      ],
    };
  if (type === 'real_estate')
    return {
      kind: 'real_estate',
      purchaseDate: null,
      location: name,
      areaSqFt: null,
      valuationSource: 'manual',
    };
  if (type === 'epf' || type === 'ppf' || type === 'nps')
    return {
      kind: type,
      accountNumberMasked: null,
      employer: null,
      annualInterestRate: null,
      lastUpdatedOn: null,
    };
  return null;
}

export function MobileHoldingForm({
  initial,
  onSave,
}: {
  readonly initial?: Holding | null;
  readonly onSave: (holding: Holding) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'stock');
  const [identifier, setIdentifier] = useState(initial?.identifier ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [currency, setCurrency] = useState<Holding['currency']>(initial?.currency ?? 'INR');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ''));
  const [value, setValue] = useState(String(initial?.manualValueOverride ?? ''));
  const [fxRate, setFxRate] = useState(String(initial?.manualFxRateToInr ?? ''));
  const [metadataText, setMetadataText] = useState(
    initial?.metadata ? JSON.stringify(initial.metadata) : '',
  );
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    try {
      const quantityValue = Number(quantity) || 0;
      const metadata = metadataText.trim()
        ? HoldingMetadataSchema.parse(JSON.parse(metadataText) as unknown)
        : metadataFor(
            type as HoldingType,
            name,
            quantityValue,
            initial?.avgCost ?? null,
            initial?.metadata ?? null,
          );
      await onSave({
        id: initial?.id,
        userId: initial?.userId,
        name,
        type: type as HoldingType,
        identifier: identifier || null,
        accountId: accountId || null,
        currency: currency as Holding['currency'],
        quantity: quantityValue,
        avgCost: initial?.avgCost ?? null,
        currentPrice: initial?.currentPrice ?? null,
        currentValue: initial?.currentValue ?? null,
        manualPriceOverride: initial?.manualPriceOverride ?? null,
        manualValueOverride: value ? Number(value) : null,
        manualFxRateToInr: fxRate ? Number(fxRate) : null,
        automaticPrice: initial?.automaticPrice ?? null,
        automaticPriceAsOf: initial?.automaticPriceAsOf ?? null,
        automaticPriceSource: initial?.automaticPriceSource ?? null,
        automaticPriceProvider: initial?.automaticPriceProvider ?? null,
        automaticPriceFxRateToInr: initial?.automaticPriceFxRateToInr ?? null,
        metadata,
        isActive: initial?.isActive ?? true,
      });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the holding details');
    }
  }
  return (
    <Card>
      <CardTitle>{initial ? 'Edit holding' : 'Add holding'}</CardTitle>
      <View className="mt-3 gap-3">
        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Reliance Industries"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field
          label="Asset type"
          hint="stock, mutual_fund, real_estate, epf, or another supported type"
        >
          <TextInput
            value={type}
            onChangeText={(text) => setType(text as HoldingType)}
            autoCapitalize="none"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Identifier">
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="RELIANCE.NS"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Account ID (optional)">
          <TextInput
            value={accountId}
            onChangeText={setAccountId}
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Holding currency" hint="INR, USD, EUR, or GBP">
          <TextInput
            value={currency}
            onChangeText={(text) => setCurrency(text as Holding['currency'])}
            autoCapitalize="characters"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Quantity">
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Manual value (₹)">
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        <Field label="Manual FX to INR">
          <TextInput
            value={fxRate}
            onChangeText={setFxRate}
            keyboardType="decimal-pad"
            className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
        </Field>
        {type === 'rsu' ||
        type === 'esop' ||
        type === 'real_estate' ||
        type === 'epf' ||
        type === 'ppf' ||
        type === 'nps' ? (
          <Field label="Special-asset metadata JSON" hint="Paste the strict object for this type">
            <TextInput
              value={metadataText}
              onChangeText={setMetadataText}
              multiline
              textAlignVertical="top"
              className="min-h-28 rounded-md border border-border bg-background px-3 py-3 font-body text-caption text-foreground"
              placeholder='{"kind":"rsu","grantDate":"2025-01-01","grantPrice":10,"sourceCurrency":"USD","vestSchedule":[{"date":"2025-07-01","quantity":10,"vested":true}]}'
            />
          </Field>
        ) : null}
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void submit()}
          className="rounded-md bg-primary px-4 py-3 active:opacity-80"
        >
          <Text className="text-center font-body text-label text-primary-foreground">
            {initial ? 'Save changes' : 'Add holding'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
