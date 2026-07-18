import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { Field } from './field';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  hint?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Field label={label} hint={hint}>
      <View className="gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          className="h-11 flex-row items-center justify-between rounded-md border border-border bg-background px-3 active:opacity-80"
        >
          <Text className="font-body text-body-md text-foreground">
            {selected?.label ?? 'Select an option'}
          </Text>
          <Text className="font-body text-body-md text-foreground-muted">⌄</Text>
        </Pressable>
        {open ? (
          <View className="rounded-md border border-border bg-surface p-1">
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: option.value === value }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`min-h-10 flex-row items-center justify-between rounded-sm px-2 ${option.value === value ? 'bg-surface-muted' : ''}`}
              >
                <Text className="font-body text-body-md text-foreground">{option.label}</Text>
                {option.value === value ? (
                  <Text className="font-body text-body-md text-primary">✓</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Field>
  );
}
