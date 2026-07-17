/**
 * Tax scenarios: the user's saved "what if" salary configurations.
 *
 * A scenario is pure input. Nothing computed is ever stored - results are
 * derived on read via computeTax, so a rule-set correction in packages/core
 * automatically re-prices every saved scenario instead of leaving stale
 * numbers on disk.
 *
 * Persistence is localStorage for now. It is deliberately behind this module's
 * four functions so Phase 3 can swap in the sync layer and attach scenarios to
 * an account without touching a component.
 */
import type { AgeBand, CityClass, TaxInput } from '@finmanager/core';
import { DEFAULT_FY } from '@finmanager/core';

/** Everything the user can configure. Mirrors TaxInput, flattened for forms. */
export interface ScenarioInput {
  fy: string;
  ageBand: AgeBand;
  ctc: number;
  cityClass: CityClass;
  /** Advanced: salary composition, as shares. */
  basicRate: number;
  hraRate: number;
  employerPfRate: number;
  employerNpsRate: number;
  gratuityRate: number;
  /** Advanced: deductions. Only the old regime uses most of these. */
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

/**
 * A middle-class metro salary with no declared investments.
 *
 * The zeroed deductions are intentional: showing the new regime winning by
 * default is honest for someone who has not told us about their 80C yet, and
 * the Advanced tab is where that gets corrected.
 */
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

/**
 * Reads saved scenarios.
 *
 * Returns [] rather than throwing on anything unexpected: a corrupt or
 * hand-edited localStorage entry must not white-screen the calculator, which
 * is meant to work before login and without a network.
 */
export function loadScenarios(): Scenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScenario).map((s) => ({
      ...s,
      // Merge over the defaults so a scenario saved before a field existed
      // still opens, rather than yielding NaN through the engine.
      input: { ...DEFAULT_SCENARIO_INPUT, ...s.input },
    }));
  } catch {
    return [];
  }
}

function isScenario(value: unknown): value is Scenario {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Scenario>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.input === 'object';
}

/** Writes scenarios, silently tolerating a full or disabled storage quota. */
export function saveScenarios(scenarios: readonly Scenario[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch {
    // Private-browsing quota errors must not break the calculator.
  }
}

export function newScenarioId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `s_${String(Date.now())}`;
}

/**
 * A tiny external store over localStorage, for useSyncExternalStore.
 *
 * Reading localStorage during render would break SSR, and reading it in an
 * effect causes a cascading re-render. useSyncExternalStore is the supported
 * shape for exactly this: it renders the server snapshot during hydration,
 * then swaps to the real one.
 */
let cache: Scenario[] | null = null;
const listeners = new Set<() => void>();

/** Stable identity: getServerSnapshot must not return a fresh array each call. */
const EMPTY: Scenario[] = [];

export function subscribeScenarios(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getScenariosSnapshot(): Scenario[] {
  cache ??= loadScenarios();
  return cache;
}

export function getServerScenariosSnapshot(): Scenario[] {
  return EMPTY;
}

/** Replaces the scenario list, persists it, and notifies subscribers. */
export function setScenarios(next: Scenario[]): void {
  cache = next;
  saveScenarios(next);
  for (const listener of listeners) listener();
}
