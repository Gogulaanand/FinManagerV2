import type { AgeBand, CityClass } from '@finmanager/core';
import { AVAILABLE_FYS, computeTax, formatInr, rulesFor } from '@finmanager/core';
import { color } from '@finmanager/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardTitle } from '../../components/card';
import { CurrencyField, Segmented } from '../../components/field';
import { RegimeCard } from '../../components/tax/regime-card';
import { TaxAdvancedForm } from '../../components/tax/tax-advanced-form';
import type { ScenarioInput } from '../../lib/tax-scenario';
import { DEFAULT_SCENARIO_INPUT, toTaxInput, useScenarios } from '../../lib/tax-scenario';

const AGE_OPTIONS: readonly { value: AgeBand; label: string }[] = [
  { value: 'below60', label: '< 60' },
  { value: 'senior', label: '60-80' },
  { value: 'superSenior', label: '80+' },
];

const CITY_OPTIONS: readonly { value: CityClass; label: string }[] = [
  { value: 'metro', label: 'Metro' },
  { value: 'nonMetro', label: 'Non-metro' },
];

const MODE_OPTIONS = [
  { value: 'easy' as const, label: 'Easy' },
  { value: 'advanced' as const, label: 'Advanced' },
];

export default function TaxScreen() {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [input, setInput] = useState<ScenarioInput>(DEFAULT_SCENARIO_INPUT);
  const [name, setName] = useState('');

  // Scenarios live in the synced local DB and stay reactive across local edits
  // and incoming syncs. The calculator renders fully without them: it must work
  // offline and before login. Saving needs an account (canSave).
  const { scenarios, canSave, saveScenario, deleteScenario } = useScenarios();

  const caps = rulesFor(input.fy).caps;
  const result = useMemo(() => computeTax(toTaxInput(input)), [input]);

  function set<K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function addScenario() {
    const trimmed = name.trim();
    if (!trimmed || !canSave) return;
    void saveScenario(trimmed, input);
    setName('');
  }

  const better = result.better === 'new' ? 'New regime' : 'Old regime';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-12"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-start gap-3">
          <View className="mt-1 size-10 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="calculator" size={21} color={scheme.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-display text-headline-lg text-foreground">Tax</Text>
            <Text className="font-body text-body-md text-foreground-muted">
              Old vs new regime. Computed on your device.
            </Text>
          </View>
        </View>

        <Segmented label="Mode" value={mode} options={MODE_OPTIONS} onChange={setMode} />

        <Card className="gap-4">
          <CardTitle>Your salary</CardTitle>
          <CurrencyField
            label="Annual CTC"
            value={input.ctc}
            onChange={(v) => {
              set('ctc', v);
            }}
            hint="Total cost to company, from your offer letter."
          />
          <Segmented
            label="City"
            value={input.cityClass}
            options={CITY_OPTIONS}
            onChange={(v) => {
              set('cityClass', v);
            }}
          />
          <Segmented
            label="Age"
            value={input.ageBand}
            options={AGE_OPTIONS}
            onChange={(v) => {
              set('ageBand', v);
            }}
            hint="Only the old regime's exemption varies by age."
          />
          {AVAILABLE_FYS.length > 1 ? (
            <Segmented
              label="Financial year"
              value={input.fy}
              options={AVAILABLE_FYS.map((fy) => ({ value: fy, label: `FY ${fy}` }))}
              onChange={(v) => {
                set('fy', v);
              }}
            />
          ) : null}
        </Card>

        {mode === 'advanced' ? <TaxAdvancedForm input={input} caps={caps} onChange={set} /> : null}

        <Card className="border border-primary">
          <View className="flex-row items-start gap-2">
            <Ionicons name="cash" size={19} color={scheme.primary} />
            <Text className="flex-1 font-body text-body-md text-foreground">
              <Text className="font-body text-body-md font-medium text-foreground">{better}</Text>{' '}
              leaves you better off by{' '}
              <Text className="font-body text-body-md font-medium text-foreground">
                {formatInr(result.savings)}
              </Text>{' '}
              a year.
            </Text>
          </View>
          <Text className="mt-1 font-body text-caption text-foreground-muted">
            FY {result.fy} rules under the {result.statute}.
          </Text>
        </Card>

        <View className="flex-row gap-3">
          <RegimeCard
            result={result.new}
            best={result.better === 'new'}
            shortfall={result.better === 'new' ? 0 : result.savings}
            compact
          />
          <RegimeCard
            result={result.old}
            best={result.better === 'old'}
            shortfall={result.better === 'old' ? 0 : result.savings}
            compact
          />
        </View>

        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="bookmark" size={18} color={scheme.primary} />
            <CardTitle>Scenarios</CardTitle>
          </View>
          <Text className="font-body text-caption text-foreground-muted">
            {canSave
              ? 'Saved to your account and synced across your devices. They work offline.'
              : 'Sign in to save scenarios to your account and sync them across devices.'}
          </Text>

          <View className="flex-row gap-2">
            <TextInput
              value={name}
              onChangeText={setName}
              editable={canSave}
              placeholder="Name it, e.g. Offer B"
              className="h-11 flex-1 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              onSubmitEditing={addScenario}
            />
            <Pressable
              onPress={addScenario}
              disabled={!name.trim() || !canSave}
              accessibilityRole="button"
              className={`h-11 justify-center rounded-md px-4 ${name.trim() && canSave ? 'bg-primary' : 'bg-surface-muted'}`}
            >
              <Text
                className={`font-body text-body-md ${name.trim() && canSave ? 'text-primary-foreground' : 'text-foreground-muted'}`}
              >
                Save
              </Text>
            </Pressable>
          </View>

          {scenarios.map((s) => {
            const r = computeTax(toTaxInput(s.input));
            const best = r.better === 'new' ? r.new : r.old;
            return (
              <View
                key={s.id}
                className="flex-row items-center justify-between gap-2 border-t border-border pt-3"
              >
                <View className="flex-1">
                  <Text className="font-body text-body-md text-foreground" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text className="font-body text-caption text-foreground-muted">
                    {formatInr(best.monthlyInHand)}/mo · {r.better === 'new' ? 'New' : 'Old'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setInput(s.input);
                  }}
                  accessibilityRole="button"
                  className="rounded-md px-3 py-2"
                >
                  <Text className="font-body text-label text-primary">Load</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void deleteScenario(s.id);
                  }}
                  accessibilityRole="button"
                  className="rounded-md px-3 py-2"
                >
                  <Text className="font-body text-label text-foreground-muted">Delete</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
