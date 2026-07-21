import { clampMonth, monthLabel, monthNow, shiftMonth } from '@finmanager/core';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

const MIN_MONTH = '2015-01';
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function MonthPickerSheet({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const currentMonth = monthNow();
  const maxMonth = shiftMonth(currentMonth, 12);
  const maxYear = Number(maxMonth.slice(0, 4));
  const monthOptions = useMemo(
    () => MONTHS.map((value) => `${year}-${String(value).padStart(2, '0')}`),
    [year],
  );
  useEffect(() => {
    if (open) setYear(Number(month.slice(0, 4)));
  }, [month, open]);
  function choose(next: string) {
    onChange(clampMonth(next, MIN_MONTH, maxMonth));
    setOpen(false);
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose month, ${monthLabel(month)}`}
        onPress={() => setOpen(true)}
        className="rounded-md px-2 py-2 active:opacity-80"
      >
        <Text className="font-body text-body-md text-foreground">{monthLabel(month)}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable
            className="rounded-t-2xl bg-surface p-5"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous year"
                disabled={year <= 2015}
                onPress={() => setYear((value) => Math.max(2015, value - 1))}
                className="rounded-md bg-surface-muted px-4 py-2 disabled:opacity-40"
              >
                <Text className="text-foreground">‹</Text>
              </Pressable>
              <Text className="font-display text-headline-md text-foreground">{year}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next year"
                disabled={year >= maxYear}
                onPress={() => setYear((value) => Math.min(maxYear, value + 1))}
                className="rounded-md bg-surface-muted px-4 py-2 disabled:opacity-40"
              >
                <Text className="text-foreground">›</Text>
              </Pressable>
            </View>
            <View className="mt-4 flex-row flex-wrap justify-between gap-y-2">
              {monthOptions.map((value) => {
                const disabled = value < MIN_MONTH || value > maxMonth;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: value === month, disabled }}
                    disabled={disabled}
                    onPress={() => choose(value)}
                    className={`w-[30%] rounded-full px-2 py-3 ${value === month ? 'bg-primary' : 'bg-surface-muted'} disabled:opacity-35`}
                  >
                    <Text
                      className={`text-center font-body text-label ${value === month ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {monthLabel(value).split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => choose(currentMonth)}
              className="mt-4 rounded-md border border-border px-4 py-3"
            >
              <Text className="text-center font-body text-label text-foreground">This month</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
