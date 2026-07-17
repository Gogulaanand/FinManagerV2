'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground',
        'outline-none transition-colors placeholder:text-foreground-muted',
        'focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/40',
        className,
      )}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  /** Rendered under the control: units, caps, statutory notes. */
  hint?: ReactNode | undefined;
  children: (id: string) => ReactNode;
  // Explicitly `| undefined`: exactOptionalPropertyTypes distinguishes an
  // omitted prop from one passed as undefined, and callers forward both.
  className?: string | undefined;
}

/** A labelled form row. The label is always bound to its control by id. */
export function Field({ label, hint, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-body text-label text-foreground-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="font-body text-caption text-foreground-muted">{hint}</p>}
    </div>
  );
}

export interface CurrencyFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode | undefined;
  max?: number | undefined;
  className?: string | undefined;
}

/**
 * A rupee input.
 *
 * Holds a `number`, not a string, so the engine never receives NaN: an empty
 * or unparseable box reads as zero. The ₹ sits inside the control rather than
 * in the label so the column of inputs aligns on the digits.
 */
export function CurrencyField({
  label,
  value,
  onChange,
  hint,
  max,
  className,
}: CurrencyFieldProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-body text-body-md text-foreground-muted"
          >
            ₹
          </span>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            value={value === 0 ? '' : value}
            placeholder="0"
            onChange={(e) => {
              const next = Number.parseFloat(e.target.value);
              onChange(Number.isFinite(next) && next >= 0 ? next : 0);
            }}
            className="tabular pl-7"
          />
        </div>
      )}
    </Field>
  );
}

export interface PercentFieldProps {
  label: string;
  /** A ratio: 0.4 displays as 40. */
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode | undefined;
}

/**
 * A percentage input over a ratio.
 *
 * The engine speaks ratios and the user speaks percentages; converting here
 * keeps that mismatch out of every call site (the same reason formatDelta
 * takes a ratio).
 */
export function PercentField({ label, value, onChange, hint }: PercentFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="relative">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.01}
            // Float ratios like 0.0481 render as 4.8100000000000005 without a
            // round-trip through a fixed precision.
            value={Number((value * 100).toFixed(4))}
            onChange={(e) => {
              const next = Number.parseFloat(e.target.value);
              onChange(Number.isFinite(next) && next >= 0 ? next / 100 : 0);
            }}
            className="tabular pr-7"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-body text-body-md text-foreground-muted"
          >
            %
          </span>
        </div>
      )}
    </Field>
  );
}

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode | undefined;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value as T);
          }}
          className={cn(
            'h-10 w-full rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground',
            'outline-none focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/40',
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export interface CheckFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckField({ label, checked, onChange }: CheckFieldProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="size-4 rounded-sm accent-primary focus-visible:ring-2 focus-visible:ring-focus"
      />
      <label htmlFor={id} className="font-body text-body-md text-foreground">
        {label}
      </label>
    </div>
  );
}
