import type { Holding, HoldingType } from '@finmanager/schema';

import { CardTitle } from '@/components/ui/card';
import { Field, Input, SelectField } from '@/components/ui/input';

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function HoldingMetadataFields({
  metadata,
  type,
  onChange,
}: {
  readonly metadata: Holding['metadata'];
  readonly type: HoldingType;
  readonly onChange: (metadata: Holding['metadata']) => void;
}): React.JSX.Element | null {
  if (!metadata) return null;
  if (metadata.kind === 'rsu' || metadata.kind === 'esop') {
    const tranche = metadata.vestSchedule[0]!;
    const update = (next: typeof metadata) => onChange(next);
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
              onChange={(event) => update({ ...metadata, grantPrice: Number(event.target.value) })}
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
  if (metadata.kind === 'real_estate') {
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
                onChange({ ...metadata, purchaseDate: event.target.value || null })
              }
            />
          )}
        </Field>
        <Field label="Location">
          {(id) => (
            <Input
              id={id}
              value={metadata.location}
              onChange={(event) => onChange({ ...metadata, location: event.target.value })}
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
                onChange({ ...metadata, areaSqFt: numberOrNull(event.target.value) })
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
                onChange({ ...metadata, valuationSource: event.target.value || null })
              }
            />
          )}
        </Field>
      </div>
    );
  }
  if (metadata.kind === 'epf' || metadata.kind === 'ppf' || metadata.kind === 'nps') {
    return (
      <div className="grid gap-4 rounded-md border border-border p-4 md:col-span-2 md:grid-cols-2">
        <CardTitle>Retirement account</CardTitle>
        <span />
        <Field label="Masked account number">
          {(id) => (
            <Input
              id={id}
              value={metadata.accountNumberMasked ?? ''}
              onChange={(event) =>
                onChange({ ...metadata, accountNumberMasked: event.target.value || null })
              }
            />
          )}
        </Field>
        <Field label="Employer">
          {(id) => (
            <Input
              id={id}
              value={metadata.employer ?? ''}
              onChange={(event) => onChange({ ...metadata, employer: event.target.value || null })}
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
              value={metadata.annualInterestRate ?? ''}
              onChange={(event) =>
                onChange({ ...metadata, annualInterestRate: numberOrNull(event.target.value) })
              }
            />
          )}
        </Field>
        <Field label="Last updated">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={metadata.lastUpdatedOn ?? ''}
              onChange={(event) =>
                onChange({ ...metadata, lastUpdatedOn: event.target.value || null })
              }
            />
          )}
        </Field>
      </div>
    );
  }
  return null;
}
