/**
 * Tax scenarios for mobile.
 *
 * Mirrors apps/web/src/lib/tax-scenario.ts field for field - the two apps must
 * compute identically - but persists through AsyncStorage, which is async and
 * has no SSR concerns, so the store shape differs from the web's.
 *
 * Both copies die in Phase 3, when packages/sync owns local storage and
 * scenarios attach to an account. Until then this is deliberate duplication,
 * like lib/sample-data.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgeBand, CityClass, TaxInput } from '@finmanager/core';
import { DEFAULT_FY } from '@finmanager/core';

export interface ScenarioInput {
  fy: string;
  ageBand: AgeBand;
  ctc: number;
  cityClass: CityClass;
  basicRate: number;
  hraRate: number;
  employerPfRate: number;
  employerNpsRate: number;
  gratuityRate: number;
  rentPaid: number;
  section80C: number;
  section80CCD1B: number;
  section80DSelf: number;
  section80DParents: number;
  section80DPreventive: number;
  isSelfSenior: boolean;
  areParentsSenior: boolean;
  professionalTax: number;
}

export interface Scenario {
  id: string;
  name: string;
  input: ScenarioInput;
}

export const DEFAULT_SCENARIO_INPUT: ScenarioInput = {
  fy: DEFAULT_FY,
  ageBand: 'below60',
  ctc: 2_400_000,
  cityClass: 'metro',
  basicRate: 0.4,
  hraRate: 0.5,
  employerPfRate: 0.12,
  employerNpsRate: 0,
  gratuityRate: 0.0481,
  rentPaid: 0,
  section80C: 0,
  section80CCD1B: 0,
  section80DSelf: 0,
  section80DParents: 0,
  section80DPreventive: 0,
  isSelfSenior: false,
  areParentsSenior: false,
  professionalTax: 2_500,
};

/** Maps the flat form shape onto the engine's input. */
export function toTaxInput(s: ScenarioInput): TaxInput {
  return {
    fy: s.fy,
    ageBand: s.ageBand,
    salary: {
      ctc: s.ctc,
      basicRate: s.basicRate,
      hraRate: s.hraRate,
      employerPfRate: s.employerPfRate,
      employerNpsRate: s.employerNpsRate,
      gratuityRate: s.gratuityRate,
      cityClass: s.cityClass,
    },
    deductions: {
      rentPaid: s.rentPaid,
      section80C: s.section80C,
      section80CCD1B: s.section80CCD1B,
      section80DSelf: s.section80DSelf,
      section80DParents: s.section80DParents,
      section80DPreventive: s.section80DPreventive,
      isSelfSenior: s.isSelfSenior,
      areParentsSenior: s.areParentsSenior,
      professionalTax: s.professionalTax,
    },
  };
}

const STORAGE_KEY = 'finmanager.tax.scenarios.v1';

function isScenario(value: unknown): value is Scenario {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Scenario>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.input === 'object';
}

/**
 * Reads saved scenarios, returning [] on anything unexpected.
 *
 * A corrupt entry must not break a calculator that is meant to work offline
 * and before login.
 */
export async function loadScenarios(): Promise<Scenario[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScenario).map((s) => ({
      ...s,
      input: { ...DEFAULT_SCENARIO_INPUT, ...s.input },
    }));
  } catch {
    return [];
  }
}

export async function saveScenarios(scenarios: readonly Scenario[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch {
    // A full storage quota must not break the calculator.
  }
}

export function newScenarioId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `s_${String(Date.now())}`;
}
