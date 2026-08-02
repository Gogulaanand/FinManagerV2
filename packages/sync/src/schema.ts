/**
 * The PowerSync client-side schema: the shape of the on-device SQLite database
 * that both web (wa-sqlite) and mobile (sql-js / OP-SQLite) expose.
 *
 * This mirrors the Postgres tables from supabase/migrations, with three rules
 * imposed by SQLite's storage classes (see PowerSync's type mapping):
 *   - Every table's `id` (uuid, text) is created automatically by the SDK, so it
 *     is never listed here.
 *   - Postgres `boolean` -> `column.integer` (0 / 1); SQLite has no boolean.
 *   - Postgres `timestamptz` / `date` / `jsonb` -> `column.text`. Dates are ISO
 *     strings; JSON columns are stringified and parsed on the way back out.
 *   - Postgres `double precision` (money, per D-014 float rupees) -> `column.real`.
 *
 * Keep this in lockstep with the Postgres migrations: a column that exists in
 * Postgres but not here simply is not queryable on the client (PowerSync stores
 * it, the view just does not surface it).
 */
import { column, Schema, Table } from '@powersync/common';

const profiles = new Table(
  {
    user_id: column.text,
    full_name: column.text,
    pan: column.text,
    default_fy: column.text,
    preferred_regime: column.text,
    currency: column.text,
    onboarded: column.integer,
    csv_mappings: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { trackPrevious: true },
);

const trusted_contacts = new Table(
  {
    user_id: column.text,
    name: column.text,
    email: column.text,
    phone: column.text,
    relationship: column.text,
    notify_after_days: column.integer,
    priority: column.integer,
    is_active: column.integer,
    disclosure_scope: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const activity_log = new Table(
  {
    user_id: column.text,
    occurred_at: column.text,
    kind: column.text,
    platform: column.text,
    metadata: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const tax_scenarios = new Table(
  {
    user_id: column.text,
    name: column.text,
    fy: column.text,
    input: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const accounts = new Table(
  {
    user_id: column.text,
    name: column.text,
    type: column.text,
    institution: column.text,
    currency: column.text,
    current_balance: column.real,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const categories = new Table(
  {
    user_id: column.text,
    name: column.text,
    kind: column.text,
    icon: column.text,
    color: column.text,
    parent_id: column.text,
    is_system: column.integer,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const transactions = new Table(
  {
    user_id: column.text,
    account_id: column.text,
    category_id: column.text,
    amount: column.real,
    direction: column.text,
    currency: column.text,
    occurred_on: column.text,
    note: column.text,
    merchant: column.text,
    is_recurring: column.integer,
    recurring_id: column.text,
    recurrence_frequency: column.text,
    recurrence_interval: column.integer,
    recurrence_end_on: column.text,
    recurrence_generated_through: column.text,
    occurrence_key: column.text,
    import_hash: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: { by_user: ['user_id'], by_account: ['account_id'], by_date: ['occurred_on'] },
    trackPrevious: true,
  },
);

const budgets = new Table(
  {
    user_id: column.text,
    category_id: column.text,
    period: column.text,
    period_start: column.text,
    amount: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_category: ['category_id'] }, trackPrevious: true },
);

const holdings = new Table(
  {
    user_id: column.text,
    name: column.text,
    type: column.text,
    identifier: column.text,
    account_id: column.text,
    currency: column.text,
    quantity: column.real,
    avg_cost: column.real,
    current_price: column.real,
    current_value: column.real,
    manual_price_override: column.real,
    manual_value_override: column.real,
    manual_fx_rate_to_inr: column.real,
    automatic_price: column.real,
    automatic_price_as_of: column.text,
    automatic_price_source: column.text,
    automatic_price_provider: column.text,
    automatic_price_fx_rate_to_inr: column.real,
    metadata: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const holding_events = new Table(
  {
    user_id: column.text,
    holding_id: column.text,
    kind: column.text,
    occurred_on: column.text,
    quantity: column.real,
    price: column.real,
    amount: column.real,
    currency: column.text,
    fx_rate_to_inr: column.real,
    note: column.text,
    import_hash: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_holding: ['holding_id'] }, trackPrevious: true },
);

const valuations = new Table(
  {
    user_id: column.text,
    holding_id: column.text,
    as_of: column.text,
    value: column.real,
    currency: column.text,
    fx_rate_to_inr: column.real,
    source: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_holding: ['holding_id'] }, trackPrevious: true },
);

const goals = new Table(
  {
    user_id: column.text,
    name: column.text,
    kind: column.text,
    target_amount: column.real,
    target_date: column.text,
    current_amount: column.real,
    expected_return: column.real,
    inflation: column.real,
    linked_holding_ids: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] }, trackPrevious: true },
);

const fire_settings = new Table(
  {
    user_id: column.text,
    annual_expenses: column.real,
    withdrawal_rate: column.real,
    expected_return: column.real,
    inflation: column.real,
    current_age: column.integer,
    retirement_age: column.integer,
    lean_multiplier: column.real,
    fat_multiplier: column.real,
    monthly_investment: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { trackPrevious: true },
);

const ai_summaries = new Table(
  {
    user_id: column.text,
    month: column.text,
    scope: column.text,
    content: column.text,
    generated_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_month: ['month'] }, trackPrevious: true },
);

const deadman_settings = new Table(
  {
    user_id: column.text,
    is_enabled: column.integer,
    threshold_days: column.integer,
    disclosure_note: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { trackPrevious: true },
);

const escalation_events = new Table(
  {
    user_id: column.text,
    kind: column.text,
    status: column.text,
    recipient: column.text,
    detail: column.text,
    created_at: column.text,
    sent_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_created: ['created_at'] }, trackPrevious: true },
);

/**
 * Local-only state used to make upload identity stable across retries. These
 * rows must survive a deliberate disconnect when the caller is preserving
 * recovery data, but they never enter PowerSync sync rules.
 */
const sync_metadata = new Table(
  {
    key: column.text,
    value: column.text,
  },
  { localOnly: true, indexes: { by_key: ['key'] } },
);

/**
 * Local-only journal for rejected or ambiguous upload transactions. Financial
 * payloads stay on-device for recovery and are never sent to telemetry.
 */
const sync_failures = new Table(
  {
    user_id: column.text,
    client_instance_id: column.text,
    transaction_id: column.integer,
    client_operation_id: column.integer,
    table_name: column.text,
    row_id: column.text,
    operation: column.text,
    operation_data: column.text,
    previous_values: column.text,
    payload_hash: column.text,
    failure_class: column.text,
    error_code: column.text,
    safe_error_message: column.text,
    first_failed_at: column.text,
    last_failed_at: column.text,
    retry_count: column.integer,
    resolution_state: column.text,
    resolved_at: column.text,
    resolution_reason: column.text,
  },
  {
    localOnly: true,
    indexes: { by_user: ['user_id'], by_transaction: ['client_instance_id', 'transaction_id'] },
  },
);

export const AppSchema = new Schema({
  profiles,
  trusted_contacts,
  activity_log,
  tax_scenarios,
  accounts,
  categories,
  transactions,
  budgets,
  holdings,
  holding_events,
  valuations,
  goals,
  fire_settings,
  ai_summaries,
  deadman_settings,
  escalation_events,
  sync_metadata,
  sync_failures,
});

/** The row types the on-device tables produce, keyed by table name. */
export type Database = (typeof AppSchema)['types'];

/**
 * Postgres `jsonb` columns, per table. PowerSync stores these as text on the
 * client; the connector must JSON.parse them before writing back to Supabase or
 * PostgREST rejects a JSON string where it expects an object/array.
 */
export const JSON_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  profiles: ['csv_mappings'],
  tax_scenarios: ['input'],
  activity_log: ['metadata'],
  holdings: ['metadata'],
  goals: ['linked_holding_ids'],
  escalation_events: ['detail'],
};
