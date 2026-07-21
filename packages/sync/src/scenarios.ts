/**
 * Tax scenarios, now backed by the synced local database instead of
 * localStorage / AsyncStorage.
 *
 * This is the single home for the scenario model that both apps used to
 * duplicate (each app's lib/tax-scenario.ts). The model is unchanged - a scenario
 * is still pure input, and results are always re-derived through computeTax, so
 * a rule-set fix re-prices every saved scenario. What changed is persistence:
 * rows live in the `tax_scenarios` table, so they sync to Supabase and follow
 * the account across devices, while still reading/writing locally (and offline)
 * before and after login.
 */
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import type { AgeBand, CityClass, TaxInput } from '@finmanager/core';
import { DEFAULT_FY } from '@finmanager/core';

import { uuidv4 } from './ids';

/** Everything the user can configure. Mirrors TaxInput, flattened for forms. */
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

/**
 * A middle-class metro salary with no declared investments. The zeroed
 * deductions are intentional: the new regime winning by default is honest for
 * someone who has not told us about their 80C yet.
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

export function newScenarioId(): string {
  return uuidv4();
}

/** The row shape stored in the `tax_scenarios` table (input is JSON text). */
interface ScenarioRow {
  id: string;
  name: string;
  input: string | null;
}

/**
 * The watched query that drives the scenarios UI. PowerSync re-runs this
 * whenever the local table changes (local edit or an incoming sync), so the
 * screen stays live without any manual refetch.
 */
export const SCENARIOS_QUERY = 'SELECT id, name, input FROM tax_scenarios ORDER BY created_at DESC';

/**
 * Turns raw rows into Scenarios, tolerating a corrupt/partial `input` by merging
 * over the defaults - a bad row must not white-screen a calculator meant to run
 * offline and before login.
 */
export function mapScenarioRows(rows: readonly ScenarioRow[]): Scenario[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    input: parseScenarioInput(row.input),
  }));
}

function parseScenarioInput(raw: string | null): ScenarioInput {
  if (!raw) return DEFAULT_SCENARIO_INPUT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SCENARIO_INPUT;
    return { ...DEFAULT_SCENARIO_INPUT, ...(parsed as Partial<ScenarioInput>) };
  } catch {
    return DEFAULT_SCENARIO_INPUT;
  }
}

/**
 * Inserts or updates a scenario for the given user. `userId` is required and
 * written into the row so the connector's upsert satisfies the RLS check
 * (auth.uid() = user_id); a null user_id would be rejected by Postgres.
 *
 * PowerSync exposes its tables as SQLite views, which do not support UPSERT
 * (`INSERT ... ON CONFLICT`). So we UPDATE first and INSERT only when no row was
 * touched - the manual upsert that works over the view's INSTEAD OF triggers.
 */
export async function saveScenario(
  db: AbstractPowerSyncDatabase,
  userId: string,
  scenario: Scenario,
): Promise<void> {
  const now = new Date().toISOString();
  const inputJson = JSON.stringify(scenario.input);

  await db.writeTransaction(async (tx) => {
    const updated = await tx.execute(
      `UPDATE tax_scenarios SET name = ?, fy = ?, input = ?, updated_at = ? WHERE id = ?`,
      [scenario.name, scenario.input.fy, inputJson, now, scenario.id],
    );

    if (!updated.rowsAffected) {
      await tx.execute(
        `INSERT INTO tax_scenarios (id, user_id, name, fy, input, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [scenario.id, userId, scenario.name, scenario.input.fy, inputJson, now, now],
      );
    }
  });
}

/** Deletes a scenario by id. RLS still applies on the eventual sync. */
export async function deleteScenario(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute('DELETE FROM tax_scenarios WHERE id = ?', [id]);
}
