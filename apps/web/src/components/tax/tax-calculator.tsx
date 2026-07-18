'use client';

import type { AgeBand, CityClass } from '@finmanager/core';
import { AVAILABLE_FYS, computeTax, formatInr, rulesFor } from '@finmanager/core';
import { useMemo, useState } from 'react';

import { RegimeCard } from '@/components/tax/regime-card';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { CheckField, CurrencyField, Input, PercentField, SelectField } from '@/components/ui/input';
import type { ScenarioInput } from '@/lib/tax-scenario';
import { DEFAULT_SCENARIO_INPUT, toTaxInput, useScenarios } from '@/lib/tax-scenario';
import { cn } from '@/lib/utils';

const AGE_OPTIONS: readonly { value: AgeBand; label: string }[] = [
  { value: 'below60', label: 'Below 60' },
  { value: 'senior', label: 'Senior (60 to 80)' },
  { value: 'superSenior', label: 'Super senior (80+)' },
];

const CITY_OPTIONS: readonly { value: CityClass; label: string }[] = [
  { value: 'metro', label: 'Metro' },
  { value: 'nonMetro', label: 'Non-metro' },
];

type Mode = 'easy' | 'advanced';

function ModeTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 rounded-md px-3 font-body text-label transition-colors',
        active
          ? 'bg-surface text-foreground shadow-sm'
          : 'text-foreground-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="font-body text-label font-medium text-foreground">{children}</p>;
}

export function TaxCalculator() {
  const [mode, setMode] = useState<Mode>('easy');
  const [input, setInput] = useState<ScenarioInput>(DEFAULT_SCENARIO_INPUT);
  const [name, setName] = useState('');

  // Scenarios live in the synced local DB and stay reactive across local edits
  // and incoming syncs. The calculator renders fully without them: it must work
  // offline and before login. Saving needs an account (canSave), since rows are
  // RLS-scoped to a user.
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md text-foreground">Tax</h1>
          <p className="font-body text-body-md text-foreground-muted">
            Old vs new regime for a salaried individual. Everything is computed on your device.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-surface-muted p-1">
          <ModeTab
            active={mode === 'easy'}
            onClick={() => {
              setMode('easy');
            }}
          >
            Easy
          </ModeTab>
          <ModeTab
            active={mode === 'advanced'}
            onClick={() => {
              setMode('advanced');
            }}
          >
            Advanced
          </ModeTab>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="flex flex-col gap-5 self-start">
          <CardTitle>Your salary</CardTitle>

          <CurrencyField
            label="Annual CTC"
            value={input.ctc}
            onChange={(v) => {
              set('ctc', v);
            }}
            hint="Total cost to company, as printed on your offer letter."
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Financial year"
              value={input.fy}
              options={AVAILABLE_FYS.map((fy) => ({ value: fy, label: `FY ${fy}` }))}
              onChange={(v) => {
                set('fy', v);
              }}
            />
            <SelectField
              label="City"
              value={input.cityClass}
              options={CITY_OPTIONS}
              onChange={(v) => {
                set('cityClass', v);
              }}
            />
          </div>

          <SelectField
            label="Age"
            value={input.ageBand}
            options={AGE_OPTIONS}
            onChange={(v) => {
              set('ageBand', v);
            }}
            hint="Only the old regime's exemption varies by age."
          />

          {mode === 'advanced' && (
            <>
              <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
                <SectionLabel>Salary composition</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
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
                    label="Employer PF"
                    value={input.employerPfRate}
                    onChange={(v) => {
                      set('employerPfRate', v);
                    }}
                  />
                  <PercentField
                    label="Employer NPS"
                    value={input.employerNpsRate}
                    onChange={(v) => {
                      set('employerNpsRate', v);
                    }}
                  />
                  <PercentField
                    label="Gratuity"
                    value={input.gratuityRate}
                    onChange={(v) => {
                      set('gratuityRate', v);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
                <SectionLabel>Deductions</SectionLabel>
                <p className="font-body text-caption text-foreground-muted">
                  The new regime allows none of these except employer NPS, so they only move the old
                  regime&apos;s number.
                </p>
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
                  max={caps.section80C}
                  hint={`Capped at ${formatInr(caps.section80C)}. Your EPF is added automatically.`}
                />
                <CurrencyField
                  label="80CCD(1B) NPS"
                  value={input.section80CCD1B}
                  onChange={(v) => {
                    set('section80CCD1B', v);
                  }}
                  max={caps.section80CCD1B}
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
                  max={caps.section80DPreventive}
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
                  max={caps.professionalTaxMax}
                  hint={`A state levy, capped at ${formatInr(caps.professionalTaxMax)} a year nationwide.`}
                />
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="bg-primary/5 ring-1 ring-primary/20">
            <p className="font-body text-body-md text-foreground">
              <span className="font-medium">{better}</span> leaves you better off by{' '}
              <span className="font-medium">{formatInr(result.savings)}</span> a year
              {result.savings === 0 && ' - the two regimes are identical here'}.
            </p>
            <p className="mt-1 font-body text-caption text-foreground-muted">
              FY {result.fy} rules under the {result.statute}.
            </p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <RegimeCard
              result={result.new}
              best={result.better === 'new'}
              shortfall={result.better === 'new' ? 0 : result.savings}
            />
            <RegimeCard
              result={result.old}
              best={result.better === 'old'}
              shortfall={result.better === 'old' ? 0 : result.savings}
            />
          </div>

          <Card>
            <CardTitle>Scenarios</CardTitle>
            <p className="mt-1 font-body text-caption text-foreground-muted">
              {canSave
                ? 'Saved to your account and synced across your devices. They work offline.'
                : 'Sign in to save scenarios to your account and sync them across devices.'}
            </p>

            <div className="mt-4 flex gap-2">
              <Input
                value={name}
                placeholder="Name this scenario, e.g. Offer B"
                disabled={!canSave}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addScenario();
                }}
              />
              <Button onClick={addScenario} disabled={!name.trim() || !canSave}>
                Save
              </Button>
            </div>

            {scenarios.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {['Scenario', 'CTC', 'Monthly in-hand', 'Better', ''].map((h) => (
                        <th
                          key={h}
                          className="pb-2 text-left font-body text-label font-medium text-foreground-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => {
                      const r = computeTax(toTaxInput(s.input));
                      const best = r.better === 'new' ? r.new : r.old;
                      return (
                        <tr key={s.id} className="border-b border-border/50">
                          <td className="py-2 font-body text-body-md text-foreground">{s.name}</td>
                          <td className="tabular py-2 font-body text-body-md text-foreground-muted">
                            {formatInr(s.input.ctc)}
                          </td>
                          <td className="tabular py-2 font-body text-body-md text-foreground">
                            {formatInr(best.monthlyInHand)}
                          </td>
                          <td className="py-2 font-body text-body-md text-foreground-muted">
                            {r.better === 'new' ? 'New' : 'Old'}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setInput(s.input);
                              }}
                            >
                              Load
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                void deleteScenario(s.id);
                              }}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
