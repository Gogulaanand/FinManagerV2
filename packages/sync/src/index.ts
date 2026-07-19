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
export {
  FIRE_SETTINGS_QUERY,
  GOALS_QUERY,
  deleteGoal,
  mapFireSettingsRows,
  mapGoalRows,
  saveFireSettings,
  saveGoal,
} from './goals';
export {
  HOLDING_EVENTS_QUERY,
  HOLDINGS_QUERY,
  VALUATIONS_QUERY,
  commitPortfolioImport,
  deleteHolding,
  deleteHoldingEvent,
  deleteValuation,
  mapHoldingEventRows,
  mapHoldingRows,
  mapValuationRows,
  saveHolding,
  saveAutomaticQuote,
  saveHoldingEvent,
  saveValuation,
} from './portfolio';
export {
  ACCOUNTS_QUERY,
  BUDGETS_QUERY,
  CATEGORIES_QUERY,
  commitCsvImport,
  PROFILE_MAPPINGS_QUERY,
  TRANSACTIONS_MONTH_COUNT_QUERY,
  TRANSACTIONS_MONTH_PAGE_QUERY,
  TRANSACTIONS_QUERY,
  TRANSACTIONS_WINDOW_QUERY,
  deleteAccount,
  deleteBudget,
  deleteCategory,
  deleteTransaction,
  ensureRecurringThrough,
  mapAccountRows,
  mapBudgetRows,
  mapCategoryRows,
  mapTransactionRows,
  materializeRecurringTransactions,
  readCsvMappings,
  saveAccount,
  saveBudget,
  saveCategory,
  saveCsvMappings,
  saveTransaction,
  seedDefaultCategories,
} from './expenses';
