import type { ReactNode } from 'react';
import { percentToRatio, ratioToPercent } from '@finmanager/core';
import { Pressable, Text, TextInput, View } from 'react-native';

export interface FieldProps {
  label: string;
  // Explicitly `| undefined`: exactOptionalPropertyTypes distinguishes an
  // omitted prop from one passed as undefined, and callers forward both.
  /** Units, caps, statutory notes. */
  hint?: string | undefined;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="font-body text-label text-foreground-muted">{label}</Text>
      {children}
      {hint ? <Text className="font-body text-caption text-foreground-muted">{hint}</Text> : null}
    </View>
  );
}

export interface CurrencyFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string | undefined;
}

/**
 * A rupee input.
 *
 * Holds a `number`, so an empty box reads as zero and the engine never sees
 * NaN. `keyboardType` is numeric because a rupee figure has no letters, and on
 * a phone the wrong keyboard is a real tax on entry.
 */
export function CurrencyField({ label, value, onChange, hint }: CurrencyFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <View className="flex-row items-center rounded-md border border-border bg-background px-3">
        <Text className="font-body text-body-md text-foreground-muted">₹</Text>
        <TextInput
          value={value === 0 ? '' : String(value)}
          placeholder="0"
          keyboardType="number-pad"
          inputMode="numeric"
          onChangeText={(text) => {
            const next = Number.parseFloat(text.replace(/[^0-9.]/g, ''));
            onChange(Number.isFinite(next) && next >= 0 ? next : 0);
          }}
          className="h-11 flex-1 pl-1 font-body text-body-md text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        />
      </View>
    </Field>
  );
}

export interface PercentFieldProps {
  label: string;
  /** A ratio: 0.4 displays as 40. */
  value: number;
  onChange: (value: number) => void;
}

/** A percentage input over a ratio. The engine speaks ratios; users do not. */
export function PercentField({ label, value, onChange }: PercentFieldProps) {
  return (
    <Field label={label}>
      <View className="flex-row items-center rounded-md border border-border bg-background px-3">
        <TextInput
          // Without the fixed precision, 0.0481 renders as 4.8100000000000005.
          value={String(ratioToPercent(value))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          onChangeText={(text) => {
            const next = Number.parseFloat(text.replace(/[^0-9.]/g, ''));
            onChange(percentToRatio(next));
          }}
          className="h-11 flex-1 font-body text-body-md text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        />
        <Text className="font-body text-body-md text-foreground-muted">%</Text>
      </View>
    </Field>
  );
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string | undefined;
}

/**
 * A segmented control, standing in for a select.
 *
 * A native picker would mean another dependency for three two-to-three-option
 * choices; segments also keep the options visible, which suits a calculator
 * the user is scanning rather than filling in once.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SegmentedProps<T>) {
  return (
    <Field label={label} hint={hint}>
      <View className="flex-row gap-1 rounded-lg bg-surface-muted p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                onChange(o.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`flex-1 items-center rounded-md px-2 py-2 ${active ? 'bg-surface' : ''}`}
            >
              <Text
                className={`font-body text-label ${active ? 'text-foreground' : 'text-foreground-muted'}`}
                numberOfLines={1}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

export interface CheckFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * A checkbox.
 *
 * The checked state carries a ✓ glyph as well as the fill, so it does not rely
 * on colour alone - the same rule the money components follow.
 */
export function CheckField({ label, checked, onChange }: CheckFieldProps) {
  return (
    <Pressable
      onPress={() => {
        onChange(!checked);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center gap-2 py-1"
    >
      <View
        className={`size-5 items-center justify-center rounded-sm border ${
          checked ? 'border-primary bg-primary' : 'border-border bg-background'
        }`}
      >
        {checked ? <Text className="font-body text-caption text-primary-foreground">✓</Text> : null}
      </View>
      <Text className="flex-1 font-body text-body-md text-foreground">{label}</Text>
    </Pressable>
  );
}
