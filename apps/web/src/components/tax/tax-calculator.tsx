'use client';

import { computeTax, formatInr, rulesFor } from '@finmanager/core';
import { useMemo, useState } from 'react';

import { RegimeCard } from '@/components/tax/regime-card';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ScenarioInput } from '@/lib/tax-scenario';
import { DEFAULT_SCENARIO_INPUT, toTaxInput, useScenarios } from '@/lib/tax-scenario';
import { cn } from '@/lib/utils';
import { TaxInputForm, type TaxMode } from './tax-input-form';

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

export function TaxCalculator() {
  const [mode, setMode] = useState<TaxMode>('easy');
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
        <TaxInputForm mode={mode} input={input} caps={caps} onChange={set} />

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
