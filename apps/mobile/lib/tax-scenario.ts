/**
 * Tax scenarios for mobile, backed by the synced local database.
 *
 * The scenario model lives in @finmanager/sync and is shared with web; this file
 * is just the mobile binding - a reactive hook over the tax_scenarios table. The
 * old AsyncStorage store is gone; scenarios now attach to the account and sync.
 *
 * The calculator still runs signed-out (compute is offline); saving needs an
 * account, since rows are RLS-scoped to a user.
 */
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

import { useAuth } from '../components/providers';

export { DEFAULT_SCENARIO_INPUT, newScenarioId, toTaxInput } from '@finmanager/sync';
export type { Scenario, ScenarioInput } from '@finmanager/sync';

interface ScenarioRow {
  id: string;
  name: string;
  input: string | null;
}

export interface ScenariosApi {
  scenarios: Scenario[];
  canSave: boolean;
  saveScenario: (name: string, input: ScenarioInput) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
}

export function useScenarios(): ScenariosApi {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

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
