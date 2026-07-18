import { reduceKeypad, type KeypadAction } from '@finmanager/core';
import { Pressable, Text, View } from 'react-native';

export interface AmountKeypadProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'] as const;

function applyAction(value: string, action: KeypadAction): string {
  return reduceKeypad(value, action);
}

export function AmountKeypad({ value, onChange, onSubmit }: AmountKeypadProps) {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {keys.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === '.' ? 'Decimal point' : `Digit ${key}`}
            onPress={() =>
              onChange(
                applyAction(
                  value,
                  key === '.' ? { type: 'decimal' } : { type: 'digit', value: key as `${number}` },
                ),
              )
            }
            className="h-14 flex-1 basis-[30%] items-center justify-center rounded-lg bg-surface-muted active:opacity-70"
          >
            <Text className="font-display text-headline-md text-foreground">{key}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Backspace"
          onPress={() => onChange(applyAction(value, { type: 'backspace' }))}
          className="h-14 flex-1 basis-[30%] items-center justify-center rounded-lg bg-surface-muted active:opacity-70"
        >
          <Text className="font-display text-headline-md text-foreground">⌫</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save amount"
        onPress={onSubmit}
        className="h-14 items-center justify-center rounded-lg bg-primary active:opacity-80"
      >
        <Text className="font-body text-body-lg font-medium text-primary-foreground">Continue</Text>
      </Pressable>
    </View>
  );
}
