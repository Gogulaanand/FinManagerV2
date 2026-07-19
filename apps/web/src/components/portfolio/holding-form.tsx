'use client';

import { HoldingMetadataSchema, type Holding, type HoldingType } from '@finmanager/schema';
import { fxRateToInrForCurrency } from '@finmanager/core';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, SelectField } from '@/components/ui/input';

const TYPES: readonly { value: HoldingType; label: string }[] = [
  { value: 'mutual_fund', label: 'Mutual fund' },
  { value: 'stock', label: 'Indian stock' },
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
];

interface HoldingFormProps {
  readonly initial?: Holding | null;
  readonly onSave: (holding: Holding) => Promise<void>;
  readonly onCancel?: () => void;
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metadataFor(
  type: HoldingType,
  name: string,
  quantity: number,
  avgCost: number | null,
  existing: Holding['metadata'],
): Holding['metadata'] {
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

export function HoldingForm({ initial = null, onSave, onCancel }: HoldingFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<HoldingType>(initial?.type ?? 'stock');
  const [identifier, setIdentifier] = useState(initial?.identifier ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [currency, setCurrency] = useState<Holding['currency']>(initial?.currency ?? 'INR');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ''));
  const [avgCost, setAvgCost] = useState(String(initial?.avgCost ?? ''));
  const [manualPrice, setManualPrice] = useState(String(initial?.manualPriceOverride ?? ''));
  const [manualValue, setManualValue] = useState(String(initial?.manualValueOverride ?? ''));
  const [manualFx, setManualFx] = useState(String(initial?.manualFxRateToInr ?? ''));
  const [metadataDraft, setMetadataDraft] = useState<Holding['metadata']>(
    initial?.metadata ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      const quantityValue = Number.parseFloat(quantity) || 0;
      const avgCostValue = numberOrNull(avgCost);
      const metadata = HoldingMetadataSchema.nullable().parse(
        metadataFor(type, name, quantityValue, avgCostValue, metadataDraft),
      );
      await onSave({
        id: initial?.id,
        userId: initial?.userId,
        name,
        type,
        identifier: identifier || null,
        accountId: accountId || null,
        currency: currency as Holding['currency'],
        quantity: quantityValue,
        avgCost: avgCostValue,
        currentPrice: initial?.currentPrice ?? null,
        currentValue: initial?.currentValue ?? null,
        manualPriceOverride: numberOrNull(manualPrice),
        manualValueOverride: numberOrNull(manualValue),
        manualFxRateToInr: fxRateToInrForCurrency(currency, manualFx),
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
      <CardHeader>
        <CardTitle>{initial ? 'Edit holding' : 'Add holding'}</CardTitle>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Reliance Industries"
            />
          )}
        </Field>
        <SelectField label="Asset type" value={type} options={TYPES} onChange={setType} />
        <Field label="Identifier" hint="Ticker, ISIN, folio, or account label">
          {(id) => (
            <Input
              id={id}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="RELIANCE.NS"
            />
          )}
        </Field>
        <Field label="Account ID" hint="Optional synced bank/broker account UUID">
          {(id) => (
            <Input
              id={id}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            />
          )}
        </Field>
        <SelectField
          label="Holding currency"
          value={currency}
          options={['INR', 'USD', 'EUR', 'GBP'].map((value) => ({ value, label: value }))}
          onChange={(value) => setCurrency(value as Holding['currency'])}
        />
        <Field label="Quantity">
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
        <Field label="Average cost (₹)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="any"
              value={avgCost}
              onChange={(event) => setAvgCost(event.target.value)}
            />
          )}
        </Field>
        <Field label="Manual price override (₹)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="any"
              value={manualPrice}
              onChange={(event) => setManualPrice(event.target.value)}
            />
          )}
        </Field>
        <Field label="Manual total value (₹)" hint="Takes precedence over all quotes">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="any"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
            />
          )}
        </Field>
        {currency !== 'INR' ? (
          <Field label="Manual FX to INR" hint="Required for non-INR manual values">
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                step="any"
                value={manualFx}
                onChange={(event) => setManualFx(event.target.value)}
                placeholder="83"
              />
            )}
          </Field>
        ) : null}
        {(() => {
          const metadata = metadataFor(
            type,
            name,
            Number(quantity) || 0,
            numberOrNull(avgCost),
            metadataDraft,
          );
          if (metadata?.kind === 'rsu' || metadata?.kind === 'esop') {
            const tranche = metadata.vestSchedule[0]!;
            const update = (next: typeof metadata) => setMetadataDraft(next);
            return (
              <div className="grid gap-4 rounded-md border border-border p-4 md:col-span-2 md:grid-cols-2">
                <CardTitle>{type.toUpperCase()} grant</CardTitle>
                <span />
                <Field label="Grant date">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={metadata.grantDate}
                      onChange={(event) => update({ ...metadata, grantDate: event.target.value })}
                    />
                  )}
                </Field>
                <Field label="Grant price">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      value={metadata.grantPrice}
                      onChange={(event) =>
                        update({ ...metadata, grantPrice: Number(event.target.value) })
                      }
                    />
                  )}
                </Field>
                <SelectField
                  label="Source currency"
                  value={metadata.sourceCurrency}
                  options={['INR', 'USD', 'EUR', 'GBP'].map((value) => ({ value, label: value }))}
                  onChange={(value) =>
                    update({ ...metadata, sourceCurrency: value as Holding['currency'] })
                  }
                />
                <Field label="Vest date">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={tranche.date}
                      onChange={(event) =>
                        update({
                          ...metadata,
                          vestSchedule: [
                            { ...tranche, date: event.target.value },
                            ...metadata.vestSchedule.slice(1),
                          ],
                        })
                      }
                    />
                  )}
                </Field>
                <Field label="Vest quantity">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      value={tranche.quantity}
                      onChange={(event) =>
                        update({
                          ...metadata,
                          vestSchedule: [
                            { ...tranche, quantity: Number(event.target.value) },
                            ...metadata.vestSchedule.slice(1),
                          ],
                        })
                      }
                    />
                  )}
                </Field>
                <label className="flex items-center gap-2 text-label text-foreground">
                  <input
                    type="checkbox"
                    checked={tranche.vested}
                    onChange={(event) =>
                      update({
                        ...metadata,
                        vestSchedule: [
                          { ...tranche, vested: event.target.checked },
                          ...metadata.vestSchedule.slice(1),
                        ],
                      })
                    }
                  />{' '}
                  Vested
                </label>
              </div>
            );
          }
          if (metadata?.kind === 'real_estate') {
            const update = (next: typeof metadata) => setMetadataDraft(next);
            return (
              <div className="grid gap-4 rounded-md border border-border p-4 md:col-span-2 md:grid-cols-2">
                <CardTitle>Property details</CardTitle>
                <span />
                <Field label="Purchase date">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={metadata.purchaseDate ?? ''}
                      onChange={(event) =>
                        update({ ...metadata, purchaseDate: event.target.value || null })
                      }
                    />
                  )}
                </Field>
                <Field label="Location">
                  {(id) => (
                    <Input
                      id={id}
                      value={metadata.location}
                      onChange={(event) => update({ ...metadata, location: event.target.value })}
                    />
                  )}
                </Field>
                <Field label="Area (sq ft)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      value={metadata.areaSqFt ?? ''}
                      onChange={(event) =>
                        update({ ...metadata, areaSqFt: numberOrNull(event.target.value) })
                      }
                    />
                  )}
                </Field>
                <Field label="Valuation source">
                  {(id) => (
                    <Input
                      id={id}
                      value={metadata.valuationSource ?? ''}
                      onChange={(event) =>
                        update({ ...metadata, valuationSource: event.target.value || null })
                      }
                    />
                  )}
                </Field>
              </div>
            );
          }
          if (metadata && ['epf', 'ppf', 'nps'].includes(metadata.kind)) {
            const retirement = metadata as Extract<
              NonNullable<Holding['metadata']>,
              { kind: 'epf' | 'ppf' | 'nps' }
            >;
            const update = (next: typeof retirement) => setMetadataDraft(next);
            return (
              <div className="grid gap-4 rounded-md border border-border p-4 md:col-span-2 md:grid-cols-2">
                <CardTitle>Retirement account</CardTitle>
                <span />
                <Field label="Masked account number">
                  {(id) => (
                    <Input
                      id={id}
                      value={retirement.accountNumberMasked ?? ''}
                      onChange={(event) =>
                        update({ ...retirement, accountNumberMasked: event.target.value || null })
                      }
                    />
                  )}
                </Field>
                <Field label="Employer">
                  {(id) => (
                    <Input
                      id={id}
                      value={retirement.employer ?? ''}
                      onChange={(event) =>
                        update({ ...retirement, employer: event.target.value || null })
                      }
                    />
                  )}
                </Field>
                <Field label="Annual interest rate (%)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      max="100"
                      value={retirement.annualInterestRate ?? ''}
                      onChange={(event) =>
                        update({
                          ...retirement,
                          annualInterestRate: numberOrNull(event.target.value),
                        })
                      }
                    />
                  )}
                </Field>
                <Field label="Last updated">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={retirement.lastUpdatedOn ?? ''}
                      onChange={(event) =>
                        update({ ...retirement, lastUpdatedOn: event.target.value || null })
                      }
                    />
                  )}
                </Field>
              </div>
            );
          }
          return null;
        })()}
      </div>
      {error ? <p className="mt-3 font-body text-caption text-loss">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={() => void submit()}>
          {initial ? 'Save changes' : 'Add holding'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
