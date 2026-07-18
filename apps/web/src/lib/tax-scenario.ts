/**
 * Tax scenarios for web, now backed by the synced local database.
 *
 * The scenario model (ScenarioInput, toTaxInput, defaults) lives in
 * @finmanager/sync and is shared with mobile - this file is just the web
 * binding: a reactive hook over the `tax_scenarios` PowerSync table. The old
 * localStorage external store is gone; rows now attach to the signed-in account
 * and sync across devices.
 *
 * The calculator still runs fully signed-out (compute is offline); saving a
 * named scenario needs an account, since every row is RLS-scoped to a user.
 */
'use client';

import {
  deleteScenario as repoDeleteScenario,
  mapScenarioRows,
  newScenarioId,
  saveScenario as repoSaveScenario,
  SCENARIOS_QUERY,
  type Scenario,
  type ScenarioInput,
} from '@finmanager/sync';
import { usePowerSync, useQuery } from '@powersync/react';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/components/providers';

export { DEFAULT_SCENARIO_INPUT, newScenarioId, toTaxInput } from '@finmanager/sync';
export type { Scenario, ScenarioInput } from '@finmanager/sync';

interface ScenarioRow {
  id: string;
  name: string;
  input: string | null;
}

export interface ScenariosApi {
  scenarios: Scenario[];
  /** Whether the user can persist a scenario (i.e. is signed in). */
  canSave: boolean;
  saveScenario: (name: string, input: ScenarioInput) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
}

export function useScenarios(): ScenariosApi {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // Reactive: PowerSync re-runs this whenever the local table changes, whether
  // from a local edit or an incoming sync, so the list stays live.
  const { data: rows } = useQuery<ScenarioRow>(SCENARIOS_QUERY);
  const scenarios = useMemo(() => mapScenarioRows(rows ?? []), [rows]);

  const saveScenario = useCallback(
    async (name: string, input: ScenarioInput) => {
      if (!userId) return;
      await repoSaveScenario(db, userId, { id: newScenarioId(), name, input });
    },
    [db, userId],
  );

  const deleteScenario = useCallback(
    async (id: string) => {
      await repoDeleteScenario(db, id);
    },
    [db],
  );

  return { scenarios, canSave: userId !== null, saveScenario, deleteScenario };
}
