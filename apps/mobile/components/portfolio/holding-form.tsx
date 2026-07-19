import { fxRateToInrForCurrency } from '@finmanager/core';
import {
  HoldingMetadataSchema,
  type Holding,
  type HoldingMetadata,
  type HoldingType,
} from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';
import { Choice } from '../choice';
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
  onCancel,
}: {
  readonly initial?: Holding | null;
  readonly onSave: (holding: Holding) => Promise<void>;
  readonly onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'stock');
  const [identifier, setIdentifier] = useState(initial?.identifier ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [currency, setCurrency] = useState<Holding['currency']>(initial?.currency ?? 'INR');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ''));
  const [value, setValue] = useState(String(initial?.manualValueOverride ?? ''));
  const [fxRate, setFxRate] = useState(String(initial?.manualFxRateToInr ?? ''));
  const [metadataDraft, setMetadataDraft] = useState<HoldingMetadata | null>(
    initial?.metadata ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    try {
      const quantityValue = Number(quantity) || 0;
      const metadata = HoldingMetadataSchema.nullable().parse(
        metadataFor(
          type as HoldingType,
          name,
          quantityValue,
          initial?.avgCost ?? null,
          metadataDraft,
        ),
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
        manualFxRateToInr: fxRateToInrForCurrency(currency, fxRate),
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
        <Choice
          label="Asset type"
          value={type as HoldingType}
          options={[
            { value: 'stock', label: 'Indian stock' },
            { value: 'mutual_fund', label: 'Mutual fund' },
            { value: 'foreign_stock', label: 'Foreign stock' },
            { value: 'rsu', label: 'RSU' },
            { value: 'esop', label: 'ESOP' },
            { value: 'epf', label: 'EPF' },
            { value: 'ppf', label: 'PPF' },
            { value: 'nps', label: 'NPS' },
            { value: 'fd', label: 'Fixed deposit' },
            { value: 'real_estate', label: 'Real estate' },
            { value: 'gold', label: 'Gold' },
            { value: 'crypto', label: 'Crypto' },
            { value: 'cash', label: 'Cash' },
          ]}
          onChange={setType}
        />
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
        <Choice
          label="Holding currency"
          value={currency}
          options={['INR', 'USD', 'EUR', 'GBP'].map((value) => ({ value, label: value }))}
          onChange={(value) => setCurrency(value as Holding['currency'])}
          hint="INR, USD, EUR, or GBP"
        />
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
        {currency !== 'INR' ? (
          <Field label="Manual FX to INR">
            <TextInput
              value={fxRate}
              onChangeText={setFxRate}
              keyboardType="decimal-pad"
              className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
            />
          </Field>
        ) : null}
        {(() => {
          const metadata = metadataFor(
            type as HoldingType,
            name,
            Number(quantity) || 0,
            initial?.avgCost ?? null,
            metadataDraft,
          );
          const inputClass =
            'h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground';
          if (metadata?.kind === 'rsu' || metadata?.kind === 'esop') {
            const tranche = metadata.vestSchedule[0]!;
            const update = (next: typeof metadata) => setMetadataDraft(next);
            return (
              <View className="gap-3 rounded-md border border-border p-3">
                <CardTitle>{metadata.kind.toUpperCase()} grant</CardTitle>
                <Field label="Grant date">
                  <TextInput
                    value={metadata.grantDate}
                    onChangeText={(grantDate) => update({ ...metadata, grantDate })}
                    placeholder="YYYY-MM-DD"
                    className={inputClass}
                  />
                </Field>
                <Field label="Grant price">
                  <TextInput
                    value={String(metadata.grantPrice)}
                    onChangeText={(value) => update({ ...metadata, grantPrice: Number(value) })}
                    keyboardType="decimal-pad"
                    className={inputClass}
                  />
                </Field>
                <Choice
                  label="Source currency"
                  value={metadata.sourceCurrency}
                  options={['INR', 'USD', 'EUR', 'GBP'].map((value) => ({ value, label: value }))}
                  onChange={(sourceCurrency) =>
                    update({ ...metadata, sourceCurrency: sourceCurrency as Holding['currency'] })
                  }
                />
                <Field label="Vest date">
                  <TextInput
                    value={tranche.date}
                    onChangeText={(date) =>
                      update({
                        ...metadata,
                        vestSchedule: [{ ...tranche, date }, ...metadata.vestSchedule.slice(1)],
                      })
                    }
                    placeholder="YYYY-MM-DD"
                    className={inputClass}
                  />
                </Field>
                <Field label="Vest quantity">
                  <TextInput
                    value={String(tranche.quantity)}
                    onChangeText={(value) =>
                      update({
                        ...metadata,
                        vestSchedule: [
                          { ...tranche, quantity: Number(value) },
                          ...metadata.vestSchedule.slice(1),
                        ],
                      })
                    }
                    keyboardType="decimal-pad"
                    className={inputClass}
                  />
                </Field>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tranche.vested }}
                  onPress={() =>
                    update({
                      ...metadata,
                      vestSchedule: [
                        { ...tranche, vested: !tranche.vested },
                        ...metadata.vestSchedule.slice(1),
                      ],
                    })
                  }
                  className="rounded-md bg-surface-muted p-3"
                >
                  <Text className="text-foreground">
                    {tranche.vested ? '✓ Vested' : 'Not vested'}
                  </Text>
                </Pressable>
              </View>
            );
          }
          if (metadata?.kind === 'real_estate') {
            const update = (next: typeof metadata) => setMetadataDraft(next);
            return (
              <View className="gap-3 rounded-md border border-border p-3">
                <CardTitle>Property details</CardTitle>
                <Field label="Purchase date">
                  <TextInput
                    value={metadata.purchaseDate ?? ''}
                    onChangeText={(purchaseDate) =>
                      update({ ...metadata, purchaseDate: purchaseDate || null })
                    }
                    placeholder="YYYY-MM-DD"
                    className={inputClass}
                  />
                </Field>
                <Field label="Location">
                  <TextInput
                    value={metadata.location}
                    onChangeText={(location) => update({ ...metadata, location })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Area (sq ft)">
                  <TextInput
                    value={String(metadata.areaSqFt ?? '')}
                    onChangeText={(value) =>
                      update({ ...metadata, areaSqFt: value ? Number(value) : null })
                    }
                    keyboardType="decimal-pad"
                    className={inputClass}
                  />
                </Field>
                <Field label="Valuation source">
                  <TextInput
                    value={metadata.valuationSource ?? ''}
                    onChangeText={(valuationSource) =>
                      update({ ...metadata, valuationSource: valuationSource || null })
                    }
                    className={inputClass}
                  />
                </Field>
              </View>
            );
          }
          if (metadata && ['epf', 'ppf', 'nps'].includes(metadata.kind)) {
            const retirement = metadata as Extract<
              HoldingMetadata,
              { kind: 'epf' | 'ppf' | 'nps' }
            >;
            const update = (next: typeof retirement) => setMetadataDraft(next);
            return (
              <View className="gap-3 rounded-md border border-border p-3">
                <CardTitle>Retirement account</CardTitle>
                <Field label="Masked account number">
                  <TextInput
                    value={retirement.accountNumberMasked ?? ''}
                    onChangeText={(accountNumberMasked) =>
                      update({ ...retirement, accountNumberMasked: accountNumberMasked || null })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Employer">
                  <TextInput
                    value={retirement.employer ?? ''}
                    onChangeText={(employer) =>
                      update({ ...retirement, employer: employer || null })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Annual interest rate (%)">
                  <TextInput
                    value={String(retirement.annualInterestRate ?? '')}
                    onChangeText={(value) =>
                      update({ ...retirement, annualInterestRate: value ? Number(value) : null })
                    }
                    keyboardType="decimal-pad"
                    className={inputClass}
                  />
                </Field>
                <Field label="Last updated">
                  <TextInput
                    value={retirement.lastUpdatedOn ?? ''}
                    onChangeText={(lastUpdatedOn) =>
                      update({ ...retirement, lastUpdatedOn: lastUpdatedOn || null })
                    }
                    placeholder="YYYY-MM-DD"
                    className={inputClass}
                  />
                </Field>
              </View>
            );
          }
          return null;
        })()}
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <View className="flex-row gap-2">
          {onCancel ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              className="flex-1 rounded-md bg-surface-muted px-4 py-3"
            >
              <Text className="text-center font-body text-label text-foreground">Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void submit()}
            className="flex-1 rounded-md bg-primary px-4 py-3 active:opacity-80"
          >
            <Text className="text-center font-body text-label text-primary-foreground">
              {initial ? 'Save changes' : 'Add holding'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
