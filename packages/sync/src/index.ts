/**
 * @finmanager/sync - the offline-first data layer shared by web and mobile.
 *
 * Platform apps supply their own PowerSync database factory (wa-sqlite on web,
 * sql-js / OP-SQLite on mobile) and Supabase client; everything here is the
 * platform-neutral core: the client schema, the Supabase connector, and the
 * typed repositories the UI reads and writes through.
 */
export { AppSchema, JSON_COLUMNS } from './schema';
export type { Database } from './schema';
export { SupabaseConnector } from './connector';
export { uuidv4 } from './ids';
export {
  DEFAULT_SCENARIO_INPUT,
  SCENARIOS_QUERY,
  deleteScenario,
  mapScenarioRows,
  newScenarioId,
  saveScenario,
  toTaxInput,
} from './scenarios';
export type { Scenario, ScenarioInput } from './scenarios';
export { logActivity } from './activity';
export type { ActivityKind, Platform } from './activity';
