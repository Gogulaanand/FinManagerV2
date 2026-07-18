# Expenses + Budgeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 4’s offline-first expenses and budgeting module on web and mobile, including CRUD, recurring concrete rows, Indian categories, budgets, charts, and synced CSV mappings.

**Architecture:** Shared Zod contracts live in `packages/schema`; all recurrence, rollup, budget, chart-series, and CSV transformations live in pure `packages/core` functions. `packages/sync` owns PowerSync queries and UPDATE-then-INSERT repositories. Web and mobile expose thin reactive hooks and platform-specific controls/renderers over the same derived values.

**Tech Stack:** TypeScript 6.0.3, Zod 4, Vitest, PowerSync 1.57/1.10, Supabase/Postgres migrations, Next.js 16, Expo 57, Recharts, Victory Native XL, Tailwind/NativeWind, React 19.2.3.

## Global Constraints

- Amounts are positive floating-point rupees; every aggregate/imported amount passes through `roundToPaise`.
- `direction` is `debit | credit`; debit is spending and credit is income.
- Read/write synced data through PowerSync `useQuery` and repositories; direct network reads in UI are forbidden.
- PowerSync tables are SQLite views: repositories must use UPDATE-then-INSERT, never `INSERT ... ON CONFLICT`.
- Add only the required Phase 4 columns; do not add recurring-rule or import-mapping tables; preserve existing RLS policies.
- Any new JSONB column must be mirrored as SQLite text and listed in `packages/sync/src/schema.ts` `JSON_COLUMNS`.
- All shared entity types and validation come from `packages/schema`.
- Write core tests before production implementations and observe the intended RED failure.
- Native dependencies are added with `npx expo install`, never bare `pnpm add`; do not install while a dev server is running.
- Do not bump TypeScript 6.0.3, ESLint 9.39.5, React 19.2.3, or Expo 57.
- Keep exact optional property types valid and avoid `react-hooks/set-state-in-effect` violations.
- Verify web in Chrome and mobile in Expo Go; report that the no-touch simulator cannot prove interactive touch flows.
- Finish with `pnpm turbo run build test lint typecheck` and `pnpm format:check` green.

---

### Task 1: Shared expense contracts and validation

**Files:**

- Create: `packages/schema/src/expenses.ts`
- Create: `packages/schema/src/csv.ts`
- Create: `packages/schema/src/expenses.test.ts`
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/core/package.json`

**Interfaces:**

- Produces `DirectionSchema`, `AccountTypeSchema`, `CategoryKindSchema`, `RecurrenceFrequencySchema`, `AccountSchema`, `CategorySchema`, `TransactionSchema`, `BudgetSchema`, `RecurrenceRuleSchema`, and their inferred types.
- Produces `CsvFieldSchema`, `CsvMappingSchema`, `CsvMappingSetSchema`, and import-row types.
- `@finmanager/core` may import types from `@finmanager/schema`; the schema package must not import core.

- [ ] **Step 1: Write the failing validation tests**

```ts
import { describe, expect, it } from 'vitest';
import { BudgetSchema, TransactionSchema } from './index';

describe('expense contracts', () => {
  it('accepts positive debit amounts and defaults currency to INR', () => {
    expect(
      TransactionSchema.parse({
        amount: 125.5,
        direction: 'debit',
        occurredOn: '2026-07-18',
      }).currency,
    ).toBe('INR');
  });

  it('rejects zero or negative money', () => {
    expect(() =>
      TransactionSchema.parse({ amount: 0, direction: 'debit', occurredOn: '2026-07-18' }),
    ).toThrow();
    expect(() =>
      BudgetSchema.parse({
        categoryId: 'cat',
        period: 'monthly',
        periodStart: '2026-07-01',
        amount: -1,
      }),
    ).toThrow();
  });

  it('rejects directions outside debit and credit', () => {
    expect(() =>
      TransactionSchema.parse({ amount: 1, direction: 'transfer', occurredOn: '2026-07-18' }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test to prove RED**

Run: `pnpm --filter @finmanager/schema test -- expenses.test.ts`

Expected: FAIL because the new schemas are not exported.

- [ ] **Step 3: Implement the minimal Zod contracts**

Use positive finite money validation and explicit enum fields:

```ts
const PositiveMoneySchema = z.number().finite().positive();
export const DirectionSchema = z.enum(['debit', 'credit']);
export const AccountTypeSchema = z.enum(['bank', 'broker', 'wallet', 'cash', 'credit_card']);
export const CategoryKindSchema = z.enum(['expense', 'income', 'transfer']);
export const RecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

export const TransactionSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  accountId: z.string().uuid().nullable().default(null),
  categoryId: z.string().uuid().nullable().default(null),
  amount: PositiveMoneySchema,
  direction: DirectionSchema,
  currency: CurrencyCodeSchema.default('INR'),
  occurredOn: z.iso.date(),
  note: z.string().nullable().default(null),
  merchant: z.string().nullable().default(null),
  isRecurring: z.boolean().default(false),
  recurringId: z.string().uuid().nullable().default(null),
  importHash: z.string().nullable().default(null),
  occurrenceKey: z.string().nullable().default(null),
});
```

Add these exact fields before exporting them from `packages/schema/src/index.ts`: `Account { id, userId, name, type, institution, currency, currentBalance, isActive }`; `Category { id, userId, name, kind, icon, color, parentId, isSystem, sortOrder }`; `Budget { id, userId, categoryId, period, periodStart, amount }`; `RecurrenceRule { frequency, interval, endOn }`; `CsvField` as `date | description | merchant | amount | debit | credit | category`; `CsvMapping { bankKey, columns, defaultCategoryId }`; and `CsvMappingSet { mappings }`. Add `@finmanager/schema: workspace:*` to core dependencies.

- [ ] **Step 4: Run schema tests and typecheck**

Run: `pnpm --filter @finmanager/schema test && pnpm --filter @finmanager/schema typecheck && pnpm --filter @finmanager/core typecheck`

Expected: PASS with the new contracts available to core.

- [ ] **Step 5: Commit**

```bash
git add packages/schema packages/core/package.json
git commit -m "feat: add shared expense contracts"
```

### Task 2: Core categories, analytics, budgets, and chart series

**Files:**

- Create: `packages/core/src/expenses/categories.ts`
- Create: `packages/core/src/expenses/analytics.ts`
- Create: `packages/core/src/expenses/analytics.test.ts`
- Create: `packages/core/src/expenses/index.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- `DEFAULT_CATEGORIES: readonly DefaultCategory[]` contains stable keys and seeded Indian expense/income categories.
- `calculateMonthlySummary(transactions, categories, month): MonthlySummary` returns rounded debit, credit, net, and transaction count.
- `calculateCategoryBreakdown(transactions, categories, month): CategoryBreakdown[]` returns renderer-neutral `{ categoryId, label, color, amount, percentage }`.
- `calculateBudgetProgress(budgets, transactions, categories, month): BudgetProgress[]` returns `{ categoryId, budget, actual, remaining, ratio, status }` with `under`, `nearLimit`, or `overspent`.
- `buildMonthlyTrend(transactions, categories, endMonth, monthCount): MonthlyTrendPoint[]` and `buildBudgetVsActual(progress): BudgetChartPoint[]` return chart-ready numbers and explicit ranges.

- [ ] **Step 1: Write failing core tests**

```ts
it('counts only debit transactions as monthly spending and rounds paise', () => {
  const result = calculateMonthlySummary(
    [
      tx({ amount: 100.005, direction: 'debit', occurredOn: '2026-07-02' }),
      tx({ amount: 50, direction: 'credit', occurredOn: '2026-07-03' }),
      tx({ amount: 80, direction: 'debit', occurredOn: '2026-06-30' }),
    ],
    categories,
    '2026-07',
  );
  expect(result).toMatchObject({ debit: 100.01, credit: 50, net: -50.01, transactionCount: 2 });
});

it('marks a category overspent without clamping the ratio', () => {
  const [progress] = calculateBudgetProgress(
    [{ categoryId: 'food', amount: 100, periodStart: '2026-07-01', period: 'monthly' }],
    [tx({ categoryId: 'food', amount: 125, direction: 'debit', occurredOn: '2026-07-10' })],
    categories,
    '2026-07',
  );
  expect(progress).toMatchObject({ actual: 125, remaining: -25, ratio: 1.25, status: 'overspent' });
});
```

- [ ] **Step 2: Run the focused core test to prove RED**

Run: `pnpm --filter @finmanager/core test -- expenses/analytics.test.ts`

Expected: FAIL because the expenses module does not exist.

- [ ] **Step 3: Implement pure aggregation functions**

Filter by the inclusive month prefix, use category kind to exclude income from expense budgets, group by category, and call `roundToPaise` on every returned monetary field. Use an 80% warning threshold and retain ratios above 1.

- [ ] **Step 4: Run focused tests, then the complete core suite**

Run: `pnpm --filter @finmanager/core test -- expenses/analytics.test.ts && pnpm --filter @finmanager/core test`

Expected: PASS with existing tax and money tests still green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/expenses packages/core/src/index.ts
git commit -m "feat: add expense analytics and budget math"
```

### Task 3: Core recurrence and CSV transformation

**Files:**

- Create: `packages/core/src/expenses/recurrence.ts`
- Create: `packages/core/src/expenses/recurrence.test.ts`
- Create: `packages/core/src/expenses/csv.ts`
- Create: `packages/core/src/expenses/csv.test.ts`
- Modify: `packages/core/src/expenses/index.ts`

**Interfaces:**

- `expandOccurrences(input: RecurrenceExpansionInput): readonly ExpandedOccurrence[]` expands from the source date through a requested month, respecting interval/end date and producing `occurrenceKey`.
- `parseCsv(text: string): CsvDocument` handles quoted commas, escaped quotes, and line endings.
- `previewCsv(document, mapping, accountId, categories): CsvImportPreview` produces valid rows, row-level errors, canonical `importHash`, positive amount, and direction.
- `canonicalImportHash(accountId, row): string` is stable for the same normalized account/date/description/amount/direction tuple.

- [ ] **Step 1: Write failing recurrence and CSV tests**

```ts
it('expands monthly occurrences from a month-end source without invalid dates', () => {
  expect(
    expandOccurrences({
      recurringId: 'r',
      amount: 500,
      direction: 'debit',
      sourceDate: '2026-01-31',
      frequency: 'monthly',
      interval: 1,
      throughMonth: '2026-04',
    }).map((x) => x.occurredOn),
  ).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
});

it('maps separate withdrawal and deposit columns into positive debit/credit rows', () => {
  const document = parseCsv(
    'Date,Narration,Withdrawal,Deposit\n2026-07-02,UPI food,250,\n2026-07-03,Salary,,50000',
  );
  const preview = previewCsv(
    document,
    {
      bankKey: 'demo',
      columns: { date: 'Date', description: 'Narration', debit: 'Withdrawal', credit: 'Deposit' },
    },
    'account-id',
    categories,
  );
  expect(preview.rows.map((row) => [row.amount, row.direction])).toEqual([
    [250, 'debit'],
    [50000, 'credit'],
  ]);
});
```

- [ ] **Step 2: Run both tests to prove RED**

Run: `pnpm --filter @finmanager/core test -- expenses/recurrence.test.ts expenses/csv.test.ts`

Expected: FAIL because recurrence and CSV functions are absent.

- [ ] **Step 3: Implement minimal pure recurrence and CSV functions**

Use a calendar-safe month-add helper that clamps to the target month’s last day. Normalize CSV headers case-insensitively, reject rows with no usable amount/date, and compute hashes from normalized strings joined by `\u001f`.

- [ ] **Step 4: Run focused and complete core tests**

Run: `pnpm --filter @finmanager/core test -- expenses/recurrence.test.ts expenses/csv.test.ts && pnpm --filter @finmanager/core test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/expenses
git commit -m "feat: add recurring and csv expense logic"
```

### Task 4: Phase 4 migration, PowerSync schema, and repositories

**Files:**

- Create: `supabase/migrations/20260718000001_phase4_expenses.sql`
- Modify: `packages/sync/src/schema.ts`
- Modify: `packages/sync/src/schema.test.ts`
- Create: `packages/sync/src/expenses.ts`
- Create: `packages/sync/src/expenses.test.ts`
- Modify: `packages/sync/src/index.ts`
- Modify: `supabase/powersync/sync-rules.yaml`

**Interfaces:**

- Queries: `ACCOUNTS_QUERY`, `CATEGORIES_QUERY`, `TRANSACTIONS_QUERY`, `BUDGETS_QUERY`, `PROFILE_MAPPINGS_QUERY`.
- Repositories: `saveAccount`, `deleteAccount`, `seedDefaultCategories`, `saveCategory`, `deleteCategory`, `saveTransaction`, `deleteTransaction`, `saveBudget`, `deleteBudget`, `saveCsvMappings`, `readCsvMappings`, and `materializeRecurringTransactions`.
- Row mappers: `mapAccountRows`, `mapCategoryRows`, `mapTransactionRows`, `mapBudgetRows` validate SQLite rows into shared domain types.

- [ ] **Step 1: Write failing repository tests**

```ts
it('updates an existing PowerSync view row and inserts only when no row was affected', async () => {
  const db = fakeDb({ updateRowsAffected: 1 });
  await saveTransaction(db, 'user-id', transaction);
  expect(db.statements[0].sql).toMatch(/^UPDATE transactions/);
  expect(db.statements.some((statement) => statement.sql.includes('ON CONFLICT'))).toBe(false);
  expect(db.statements.filter((statement) => statement.sql.startsWith('INSERT')).length).toBe(0);
});

it('does not materialize an occurrence whose occurrence_key already exists', async () => {
  const db = fakeDb({ existingOccurrenceKeys: ['r:2026-07-15'] });
  const result = await materializeRecurringTransactions(db, 'user-id', source, '2026-07');
  expect(result.created).toBe(0);
});
```

- [ ] **Step 2: Run sync tests to prove RED**

Run: `pnpm --filter @finmanager/sync test -- expenses.test.ts`

Expected: FAIL because the repositories and new client fields are absent.

- [ ] **Step 3: Add the migration and mirror fields**

The migration adds `profiles.csv_mappings`, recurrence metadata, `occurrence_key`, checks for positive transaction/budget amounts and debit/credit, a monthly budget uniqueness index, and lookup indexes. Do not create new tables or alter RLS. Add the same fields to `AppSchema`, add `profiles.csv_mappings` to `JSON_COLUMNS`, and update the schema drift test.

- [ ] **Step 4: Implement repositories with explicit UPDATE-then-INSERT**

Every save updates by `id`; when `rowsAffected` is zero it inserts `(id, user_id, ... created_at, updated_at)`. `seedDefaultCategories` looks up by user/name/kind before inserting. `materializeRecurringTransactions` queries occurrence keys, inserts only missing concrete rows, then updates the source watermark. CSV import queries `import_hash` before calling `saveTransaction`. Profile mappings update the existing trigger-created profile row and JSON.stringify/parse at the PowerSync boundary.

- [ ] **Step 5: Run sync tests and typecheck**

Run: `pnpm --filter @finmanager/sync test && pnpm --filter @finmanager/sync typecheck`

Expected: PASS with no UPSERT text in production repositories.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260718000001_phase4_expenses.sql supabase/powersync/sync-rules.yaml packages/sync/src
git commit -m "feat: add synced expense repositories"
```

### Task 5: Web reactive hook and Expenses workspace

**Files:**

- Create: `apps/web/src/lib/expenses.ts`
- Create: `apps/web/src/components/expenses/expenses-workspace.tsx`
- Create: `apps/web/src/components/expenses/transaction-form.tsx`
- Create: `apps/web/src/components/expenses/budget-section.tsx`
- Create: `apps/web/src/components/expenses/expense-charts.tsx`
- Create: `apps/web/src/components/expenses/csv-import.tsx`
- Modify: `apps/web/src/app/expenses/page.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**

- `useExpenses()` returns reactive accounts, categories, transactions, budgets, profile mappings, current month, summary, category breakdown, budget progress, trend, and repository callbacks.
- `TransactionForm` accepts optional `initialTransaction` and `onSave(transactionInput)`; it never performs calculations beyond input normalization.
- `ExpenseCharts` accepts the core-produced chart series and passes them directly to Recharts.

- [ ] **Step 1: Add the web chart dependency while servers are stopped**

Run: `pnpm --filter @finmanager/web add recharts`

Expected: `apps/web/package.json` and `pnpm-lock.yaml` change only for the chart dependency. Do not run this with Next or Metro active.

- [ ] **Step 2: Implement the reactive hook**

Use `usePowerSync`, `useQuery`, `useAuth`, `useMemo`, and `useCallback` following `useScenarios`. Seed categories in a guarded effect after `session?.user.id` is available; do not set React state from the effect. Map rows through sync helpers and call core functions for all displayed values.

- [ ] **Step 3: Implement transaction and budget forms**

The web form uses positive `CurrencyField`, debit/credit selector, account/category selectors, date, merchant/note, and recurrence fields. Inline Zod errors block repository calls. Editing calls `saveTransaction` with the existing ID; deleting calls `deleteTransaction` after an explicit confirmation.

- [ ] **Step 4: Implement the workspace and charts**

Render month navigation, summary cards, transaction rows with signed display only (`Amount signed`), budget progress/overspend states, monthly trend, category breakdown, and budget-vs-actual. Render “no data” states without inventing sample rows. Add account/category management and CSV preview/commit controls in the same route.

- [ ] **Step 5: Run web checks**

Run: `pnpm --filter @finmanager/web typecheck && pnpm --filter @finmanager/web lint && pnpm --filter @finmanager/web build`

Expected: PASS with no direct Supabase data queries in Expenses UI files.

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add web expenses workspace"
```

### Task 6: Mobile amount-first Expenses screen and charts

**Files:**

- Create: `apps/mobile/lib/expenses.ts`
- Create: `apps/mobile/components/expenses/amount-keypad.tsx`
- Create: `apps/mobile/components/expenses/transaction-form.tsx`
- Create: `apps/mobile/components/expenses/expense-charts.tsx`
- Create: `packages/core/src/expenses/keypad.ts`
- Create: `packages/core/src/expenses/keypad.test.ts`
- Modify: `apps/mobile/app/(tabs)/expenses.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `packages/core/src/expenses/index.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- `useExpenses()` mirrors the web hook’s domain return shape and uses the same sync/core functions.
- `AmountKeypad` accepts `{ value: string; onChange(value: string): void; onSubmit(): void }` and emits digit, decimal, backspace, and submit actions without negative values.
- `MobileTransactionForm` opens with amount and direction, then category/account/date/merchant/note/recurrence.

- [ ] **Step 1: Add Victory Native XL through Expo**

With Metro stopped, run the Expo-compatible install command: `cd apps/mobile && npx expo install victory-native`.

Expected: Expo selects a compatible dependency without changing the pinned Expo/React versions. Import the installed Victory Native XL API from its documented `victory-native` entrypoint and record that exact import in `expense-charts.tsx`; do not change versions to solve an import mismatch.

- [ ] **Step 2: Write the amount-keypad behavior test or executable component harness**

The mobile workspace has no test script, so keep keypad behavior in a platform-free reducer exported from `packages/core/src/expenses/keypad.ts`; the mobile component only renders its actions:

```ts
expect(reduceKeypad('12.5', { type: 'digit', value: '0' })).toBe('12.50');
expect(reduceKeypad('12.50', { type: 'backspace' })).toBe('12.5');
expect(reduceKeypad('', { type: 'decimal' })).toBe('0.');
```

Run `pnpm --filter @finmanager/core test -- expenses/keypad.test.ts` and observe RED before implementing the reducer. Then import `reduceKeypad` into `amount-keypad.tsx` and run the mobile typecheck.

- [ ] **Step 3: Implement the amount-first form**

Use local string input until submit, parse only a finite positive number, and pass a validated positive amount to the shared transaction repository. Keep secondary controls below the keypad and use `Pressable` accessibility labels for every key and action.

- [ ] **Step 4: Implement the list, budget cards, and chart adapters**

Use the mobile hook and core-produced series. Victory receives values directly from core; the adapter chooses axes/colors only. Keep the selected month and overspend copy identical to web.

- [ ] **Step 5: Run mobile checks**

Run: `pnpm --filter @finmanager/mobile typecheck && pnpm --filter @finmanager/mobile lint && npx expo export --platform ios`

Expected: PASS and a bundle that boots in Expo Go. Record that the no-touch simulator cannot prove keypad interaction.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat: add mobile amount-first expenses"
```

### Task 7: Cross-platform CSV import and recurrence integration

**Files:**

- Modify: `apps/web/src/components/expenses/csv-import.tsx`
- Modify: `apps/mobile/components/expenses/transaction-form.tsx`
- Modify: `apps/web/src/lib/expenses.ts`
- Modify: `apps/mobile/lib/expenses.ts`
- Modify: `packages/sync/src/expenses.ts`
- Modify: `packages/core/src/expenses/recurrence.ts`
- Modify: `packages/core/src/expenses/csv.ts`
- Create: `packages/sync/src/expenses.integration.test.ts`

**Interfaces:**

- `commitCsvImport(db, userId, previewRows)` skips rows whose `import_hash` already exists and returns `{ created, skipped, failed }`.
- `ensureRecurringThrough(db, userId, month)` materializes missing rows once and preserves deletions after the source watermark.

- [ ] **Step 1: Write the integration tests**

```ts
it('imports the same CSV twice without duplicate transactions', async () => {
  const first = await commitCsvImport(db, 'user-id', preview.rows);
  const second = await commitCsvImport(db, 'user-id', preview.rows);
  expect(first.created).toBe(2);
  expect(second).toMatchObject({ created: 0, skipped: 2 });
});

it('materializes recurring rows once and does not recreate a deleted prior occurrence', async () => {
  await ensureRecurringThrough(db, 'user-id', '2026-07');
  await deleteTransaction(db, 'occurrence-id');
  await ensureRecurringThrough(db, 'user-id', '2026-07');
  expect(await countByOccurrenceKey(db, 'r:2026-06-30')).toBe(0);
});
```

- [ ] **Step 2: Run integration tests to prove RED**

Run: `pnpm --filter @finmanager/sync test -- expenses.integration.test.ts`

Expected: FAIL until import commit and recurrence watermark coordination exist.

- [ ] **Step 3: Implement preview/commit and recurrence coordination**

Keep all hash/date/amount conversion in core. The UI only chooses a file, mapping, account, and confirms valid preview rows. Sync commit performs local duplicate checks and repository writes; recurrence runs on selected-month changes and after creating a recurring source transaction.

- [ ] **Step 4: Run focused integration and complete checks**

Run: `pnpm --filter @finmanager/sync test -- expenses.integration.test.ts && pnpm --filter @finmanager/core test && pnpm --filter @finmanager/sync test`

Expected: PASS with duplicate import and recurrence tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web apps/mobile packages/core/src/expenses packages/sync/src/expenses.integration.test.ts packages/sync/src/expenses.ts
git commit -m "feat: integrate recurring and csv expense flows"
```

### Task 8: Full verification, browser/mobile evidence, and phase handoff

**Files:**

- Modify: `STATUS.md`
- Modify: `HANDOFF.md`
- Modify: `DECISIONS.md`
- Create: `phases/briefing/phase-4.md`

- [ ] **Step 1: Run the complete static and test gates**

Run: `pnpm turbo run build test lint typecheck`.

Expected: every workspace task passes. Then run `pnpm format:check`.

- [ ] **Step 2: Verify the web flow in Chrome**

Start the web dev server only after dependencies are installed. With the Phase 3 test account, seed categories, create an account, add a debit, edit it, delete it, set a monthly budget, verify progress and an overspend state, inspect all three charts, import a CSV twice, and confirm the second import skips duplicates. Disconnect PowerSync through the existing dev handle, add a transaction, reconnect, and confirm it appears after sync.

- [ ] **Step 3: Verify mobile in Expo Go**

Boot Expo Go, sign in, use the amount-first keypad to add a debit, set a budget, compare visible totals/charts with web, and exercise reconnect/sync where possible. State plainly that the iOS simulator has no touch input; a real device is required to claim interactive keypad and offline relaunch evidence. Do not claim the in-memory SQL.js adapter persists offline rows across relaunch.

- [ ] **Step 4: Write the phase briefing**

`phases/briefing/phase-4.md` must be 100–200 lines and include: what was built, exact file paths, the union of files touched, verification commands/results, web/mobile/offline evidence and simulator limitation, open items, and the next phase copied verbatim from `PRODUCTION_PLAN.md` (`### Phase 5: Portfolio + Investments` through its exit criterion).

- [ ] **Step 5: Update status, handoff, and decisions**

Mark Phase 4 Done with its briefing link and sessions spent in `STATUS.md`. Rewrite `HANDOFF.md` from the existing template. Append decisions for positive amounts/direction, manual balances, concrete recurrence storage, and synced profile mappings to `DECISIONS.md`.

- [ ] **Step 6: Commit the completed phase**

```bash
git add STATUS.md HANDOFF.md DECISIONS.md phases/briefing/phase-4.md
git commit -m "docs: complete Phase 4 expenses and budgeting"
```

## Self-review checklist

- Coverage: CRUD, Indian categories, accounts, recurring rows, budgets, overspend, three chart series, generic CSV mapping, synced saved mappings, web/mobile parity, offline verification, and phase handoff are all assigned above.
- Placeholder scan: no task relies on “TBD”, “TODO”, or unspecified edge-case handling; all expected commands and behaviors are named.
- Type consistency: shared `Transaction`, `Budget`, `CsvMapping`, `MonthlySummary`, `BudgetProgress`, `ExpandedOccurrence`, and repository names are introduced before their consumers.
- Scope consistency: the plan adds only transaction/profile columns, keeps RLS unchanged, keeps core math platform-free, and does not create new tables.
