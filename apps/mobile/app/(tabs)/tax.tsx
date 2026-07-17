import type { AgeBand, CityClass } from '@finmanager/core';
import { AVAILABLE_FYS, computeTax, formatInr, rulesFor } from '@finmanager/core';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardTitle } from '../../components/card';
import { CheckField, CurrencyField, PercentField, Segmented } from '../../components/field';
import { RegimeCard } from '../../components/tax/regime-card';
import type { Scenario, ScenarioInput } from '../../lib/tax-scenario';
import {
  DEFAULT_SCENARIO_INPUT,
  loadScenarios,
  newScenarioId,
  saveScenarios,
  toTaxInput,
} from '../../lib/tax-scenario';

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
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [input, setInput] = useState<ScenarioInput>(DEFAULT_SCENARIO_INPUT);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [name, setName] = useState('');

  // AsyncStorage is async and there is no SSR here, so the list simply arrives
  // a tick after first paint. The calculator renders fully without it: it must
  // work offline and before login.
  useEffect(() => {
    let alive = true;
    void loadScenarios().then((saved) => {
      if (alive) setScenarios(saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  const caps = rulesFor(input.fy).caps;
  const result = useMemo(() => computeTax(toTaxInput(input)), [input]);

  function set<K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function persist(next: Scenario[]) {
    setScenarios(next);
    void saveScenarios(next);
  }

  function addScenario() {
    const trimmed = name.trim();
    if (!trimmed) return;
    persist([...scenarios, { id: newScenarioId(), name: trimmed, input }]);
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
        <View>
          <Text className="font-display text-headline-lg text-foreground">Tax</Text>
          <Text className="font-body text-body-md text-foreground-muted">
            Old vs new regime. Computed on your device.
          </Text>
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

        {mode === 'advanced' ? (
          <>
            <Card className="gap-4">
              <CardTitle>Salary composition</CardTitle>
              <PercentField
                label="Basic (of CTC)"
                value={input.basicRate}
                onChange={(v) => {
                  set('basicRate', v);
                }}
              />
              <PercentField
                label="HRA (of basic)"
                value={input.hraRate}
                onChange={(v) => {
                  set('hraRate', v);
                }}
              />
              <PercentField
                label="Employer PF (of basic)"
                value={input.employerPfRate}
                onChange={(v) => {
                  set('employerPfRate', v);
                }}
              />
              <PercentField
                label="Employer NPS (of basic)"
                value={input.employerNpsRate}
                onChange={(v) => {
                  set('employerNpsRate', v);
                }}
              />
              <PercentField
                label="Gratuity (of basic)"
                value={input.gratuityRate}
                onChange={(v) => {
                  set('gratuityRate', v);
                }}
              />
            </Card>

            <Card className="gap-4">
              <CardTitle>Deductions</CardTitle>
              <Text className="font-body text-caption text-foreground-muted">
                The new regime allows none of these except employer NPS, so they only move the old
                regime&apos;s number.
              </Text>
              <CurrencyField
                label="Annual rent paid"
                value={input.rentPaid}
                onChange={(v) => {
                  set('rentPaid', v);
                }}
                hint="For the HRA exemption."
              />
              <CurrencyField
                label="80C investments"
                value={input.section80C}
                onChange={(v) => {
                  set('section80C', v);
                }}
                hint={`Capped at ${formatInr(caps.section80C)}. Your EPF is added automatically.`}
              />
              <CurrencyField
                label="80CCD(1B) NPS"
                value={input.section80CCD1B}
                onChange={(v) => {
                  set('section80CCD1B', v);
                }}
                hint={`Capped at ${formatInr(caps.section80CCD1B)}, over and above 80C.`}
              />
              <CurrencyField
                label="80D self and family"
                value={input.section80DSelf}
                onChange={(v) => {
                  set('section80DSelf', v);
                }}
              />
              <CurrencyField
                label="80D parents"
                value={input.section80DParents}
                onChange={(v) => {
                  set('section80DParents', v);
                }}
              />
              <CurrencyField
                label="Preventive health check-up"
                value={input.section80DPreventive}
                onChange={(v) => {
                  set('section80DPreventive', v);
                }}
                hint={`Capped at ${formatInr(caps.section80DPreventive)}, inside the 80D limit.`}
              />
              <CheckField
                label="I am a senior citizen"
                checked={input.isSelfSenior}
                onChange={(v) => {
                  set('isSelfSenior', v);
                }}
              />
              <CheckField
                label="My parents are senior citizens"
                checked={input.areParentsSenior}
                onChange={(v) => {
                  set('areParentsSenior', v);
                }}
              />
              <CurrencyField
                label="Professional tax"
                value={input.professionalTax}
                onChange={(v) => {
                  set('professionalTax', v);
                }}
                hint={`A state levy, capped at ${formatInr(caps.professionalTaxMax)} a year.`}
              />
            </Card>
          </>
        ) : null}

        <Card className="border border-primary">
          <Text className="font-body text-body-md text-foreground">
            <Text className="font-body text-body-md font-medium text-foreground">{better}</Text>{' '}
            leaves you better off by{' '}
            <Text className="font-body text-body-md font-medium text-foreground">
              {formatInr(result.savings)}
            </Text>{' '}
            a year.
          </Text>
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
          <CardTitle>Scenarios</CardTitle>
          <Text className="font-body text-caption text-foreground-muted">
            Saved on this device. They survive a relaunch and work offline.
          </Text>

          <View className="flex-row gap-2">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name it, e.g. Offer B"
              className="h-11 flex-1 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              onSubmitEditing={addScenario}
            />
            <Pressable
              onPress={addScenario}
              disabled={!name.trim()}
              accessibilityRole="button"
              className={`h-11 justify-center rounded-md px-4 ${name.trim() ? 'bg-primary' : 'bg-surface-muted'}`}
            >
              <Text
                className={`font-body text-body-md ${name.trim() ? 'text-primary-foreground' : 'text-foreground-muted'}`}
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
                    persist(scenarios.filter((x) => x.id !== s.id));
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
