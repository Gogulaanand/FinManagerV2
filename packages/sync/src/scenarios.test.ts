import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCENARIO_INPUT,
  mapScenarioRows,
  newScenarioId,
  toTaxInput,
  type ScenarioInput,
} from './scenarios';

describe('mapScenarioRows', () => {
  it('parses a well-formed row into a Scenario', () => {
    const input: ScenarioInput = { ...DEFAULT_SCENARIO_INPUT, ctc: 3_600_000, rentPaid: 300_000 };
    const [scenario] = mapScenarioRows([
      { id: 'a', name: 'Offer B', input: JSON.stringify(input) },
    ]);
    expect(scenario).toEqual({ id: 'a', name: 'Offer B', input });
  });

  it('falls back to defaults for null input rather than throwing', () => {
    const [scenario] = mapScenarioRows([{ id: 'a', name: 'Empty', input: null }]);
    expect(scenario?.input).toEqual(DEFAULT_SCENARIO_INPUT);
  });

  it('falls back to defaults for corrupt JSON', () => {
    const [scenario] = mapScenarioRows([{ id: 'a', name: 'Broken', input: '{not json' }]);
    expect(scenario?.input).toEqual(DEFAULT_SCENARIO_INPUT);
  });

  it('merges a partial input over the defaults so old rows still open', () => {
    // A row saved before a field existed must not yield NaN through the engine.
    const [scenario] = mapScenarioRows([
      { id: 'a', name: 'Partial', input: JSON.stringify({ ctc: 1_200_000 }) },
    ]);
    expect(scenario?.input).toEqual({ ...DEFAULT_SCENARIO_INPUT, ctc: 1_200_000 });
  });
});

describe('toTaxInput', () => {
  it('maps the flat form shape onto the engine input', () => {
    const taxInput = toTaxInput(DEFAULT_SCENARIO_INPUT);
    expect(taxInput.fy).toBe(DEFAULT_SCENARIO_INPUT.fy);
    expect(taxInput.salary.ctc).toBe(DEFAULT_SCENARIO_INPUT.ctc);
    expect(taxInput.salary.cityClass).toBe(DEFAULT_SCENARIO_INPUT.cityClass);
    expect(taxInput.deductions?.section80C).toBe(DEFAULT_SCENARIO_INPUT.section80C);
    expect(taxInput.deductions?.professionalTax).toBe(DEFAULT_SCENARIO_INPUT.professionalTax);
  });
});

describe('newScenarioId', () => {
  it('produces a valid RFC 4122 v4 UUID', () => {
    const id = newScenarioId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newScenarioId()));
    expect(ids.size).toBe(1000);
  });
});
