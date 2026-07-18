# Phase 3 Briefing: Auth + Offline-First Data Layer

Status: Done (2026-07-18, 1 session).
Read this instead of scanning the repo. Everything Phase 4 needs is listed below.

## What was built

Auth (Supabase, email+password) and a working offline-first sync layer (PowerSync)
on both platforms, plus the full data model with per-table RLS. Tax scenarios were
migrated off local storage onto the synced database. Verified end to end on web,
including the offline-write-then-sync round trip; verified on mobile up to the
limit of a no-touch simulator (see Verification).

### The backend (live Supabase project `finmanager`, ref `vkivzhbckfsjtvzatuiz`, ap-south-1)

- `supabase/migrations/20260717000001_full_data_model.sql` - the **13-table data
  model for the whole app**, created now so later phases only add columns/UI:
  `profiles`, `trusted_contacts`, `activity_log`, `tax_scenarios`, `accounts`,
  `categories`, `transactions`, `budgets`, `holdings`, `holding_events`,
  `valuations`, `goals`, `fire_settings`. Every table has the same shape:
  `id uuid pk`, `user_id uuid -> auth.users`, `created_at`/`updated_at` (trigger),
  RLS enabled with `for all to authenticated using (auth.uid() = user_id)` plus
  CRUD grants to `authenticated`, and a `user_id` index. Money is `double
precision` (float rupees, D-014), never numeric. A `handle_new_user` trigger
  creates a profile row on signup.
- `supabase/migrations/20260717000002_harden_functions.sql` - pins
  `set_updated_at`'s search_path and revokes the `handle_new_user` RPC. Security
  advisors are clean.
- `supabase/powersync/setup.sql` - the `powersync_role` + `powersync` publication
  (run once in the SQL editor; password out-of-band). `supabase/powersync/sync-rules.yaml`
  - per-user Sync Streams (edition 3, `auth.user_id()`), one query per table.

### packages/sync (the offline-first data layer, shared by web + mobile)

- `schema.ts` - `AppSchema` mirroring the 13 Postgres tables for on-device SQLite
  (booleans -> integer, timestamps/jsonb -> text, money -> real; `id` is auto).
  `JSON_COLUMNS` lists the jsonb columns. `schema.test.ts` is a drift guard.
- `connector.ts` - `SupabaseConnector` implementing `PowerSyncBackendConnector`:
  `fetchCredentials` (Supabase session token, null when signed out) and
  `uploadData` (drains the local write queue to PostgREST, JSON.parses jsonb
  columns, discards fatal ops and retries transient ones).
- `scenarios.ts` - the shared scenario model (`ScenarioInput`, `toTaxInput`,
  `DEFAULT_SCENARIO_INPUT`, moved out of both apps) + `SCENARIOS_QUERY`,
  `mapScenarioRows`, and `saveScenario`/`deleteScenario` repositories. `saveScenario`
  is UPDATE-then-INSERT, not UPSERT (PowerSync tables are SQLite views).
- `activity.ts` - `logActivity` (one `activity_log` row per app open). `ids.ts` -
  `uuidv4` from the platform CSPRNG (real UUIDs for the Postgres uuid PK).
- 15 unit tests (`scenarios.test.ts`, `schema.test.ts`).

### apps/web (Next.js)

- `lib/supabase.ts` (browser client), `lib/powersync.ts` (wa-sqlite singleton +
  connector). `components/providers.tsx` - `AppProviders`: auth context,
  PowerSync connect/disconnect in lockstep with the session
  (`disconnectAndClear` on sign-out), and the activity-log hook. Includes a
  dev-only `window.__ps` handle (NODE_ENV-guarded) for the offline test.
- `app/login/page.tsx` (email+password and Google), `components/auth-status.tsx`
  (header control), `app/layout.tsx` wraps everything in `AppProviders`.
- `lib/tax-scenario.ts` rewritten to a reactive `useScenarios` hook over the
  synced table (localStorage store gone). `components/tax/tax-calculator.tsx`
  uses it; saving is gated on `canSave` (signed-in).
- Plumbing: `next.config.ts` (Turbopack + disableStaticImages), a `postinstall`
  running `powersync-web copy-assets -o public` (workers into
  `public/@powersync/`, gitignored), eslint ignores those assets.

### apps/mobile (Expo)

- `lib/supabase.ts` (AsyncStorage-backed sessions), `lib/powersync.ts` (SQL.js
  adapter so it runs in **Expo Go**, D-021). `components/providers.tsx` mirrors
  web (no Google yet). `components/app-lock.tsx` - biometric lock
  (expo-local-authentication) that locks on cold start / foreground-return when
  biometrics are enrolled, passes through otherwise.
- `app/login.tsx` (email+password), reachable from a new Account section in
  `app/(tabs)/settings.tsx` (sign in / sign out). `app/_layout.tsx` imports the
  `react-native-get-random-values` polyfill and wraps in `AppProviders` + `AppLock`.
- `lib/tax-scenario.ts` rewritten to the reactive hook (AsyncStorage store gone).
  `app/(tabs)/tax.tsx` uses it.

## Verification evidence

- `pnpm turbo run build test lint typecheck` -> **21/21**; `pnpm format:check` clean.
- **RLS** proven at the PostgREST layer: as the `authenticated` role with user B's
  JWT claims, B reads 0 of user A's rows and is BLOCKED from forging a row as A;
  the owning user sees exactly its own row (D-024).
- **Web (Chrome, live backend):** signed up + signed in; the signup trigger created
  a `profiles` row; the app-open `activity_log` rows synced up; a saved scenario
  synced to Supabase with its jsonb `input` intact; and the **offline round trip** -
  with PowerSync disconnected, a new scenario was written to local SQLite (queued,
  absent from Supabase) and synced up on reconnect.
- **Mobile (Expo Go, iOS sim):** the full stack bundles (1857 modules) and boots
  with no runtime errors - PowerSync sql-js initializes, the Supabase client and
  AppLock mount, and the Tax screen computes via the reactive `useQuery`, matching
  web. Interactive sign-in/save/sync could not be driven in this no-touch
  simulator; those paths are the same shared connector proven on web.

## Pitfalls that cost time (do not rediscover these)

1. **PowerSync client tables are SQLite views** - `INSERT ... ON CONFLICT` (UPSERT)
   fails with "cannot UPSERT a view". Use UPDATE-then-INSERT. Only surfaced in the
   browser E2E, never in typecheck/lint (D-022).
2. **jsonb columns round-trip as text on the client**; the connector must
   `JSON.parse` them before writing back or PostgREST rejects the string (D-022).
3. **Native PowerSync adapters can't run in Expo Go** - use `@powersync/adapter-sql-js`
   (in-memory, dev-only) to keep the Expo Go loop; OP-SQLite is the Phase 9 swap (D-021).
4. **Supabase email confirmation is ON and the built-in mailer is rate-limited**, so
   real signups can't complete; the test user was confirmed via a direct
   `email_confirmed_at` update. Needs SMTP/Resend or a deliberate toggle (D-024).
5. **A comment containing `*/`** (e.g. a path glob `apps/*/lib`) silently closes a
   JSDoc block and cascades into dozens of parse errors. Reword such comments.
6. **ESLint scans copied worker assets** under `public/@powersync/` (1800+ bogus
   errors) until ignored in `eslint.config.mjs`.
7. **`form_input` in browser automation doesn't fire React onChange** - controlled
   inputs stay empty; type via real keystrokes to drive a save.

## Env / accounts (all wired this phase)

- Supabase project `finmanager` (ref `vkivzhbckfsjtvzatuiz`). PowerSync instance
  `6a5b0b247f33bac37ef7cefc`. Google OAuth set up by the owner.
- Client env (gitignored, values are public client identifiers): `apps/web/.env.local`
  and `apps/mobile/.env` hold `*_SUPABASE_URL`, `*_SUPABASE_ANON_KEY`,
  `*_POWERSYNC_URL`. `.env.example` documents them.
- A web test account (`gogulaanand02+webtest@gmail.com`) with two synced scenarios
  exists in Supabase - sign in with it on a real device to see cross-platform
  sync-down, then delete it. Google sign-in on mobile is not wired yet.

## Union of files touched

```
.gitignore  .prettierignore  eslint.config.mjs  pnpm-workspace.yaml  pnpm-lock.yaml
PRODUCTION_PLAN.md  DECISIONS.md (D-021..D-024)  STATUS.md  HANDOFF.md
supabase/migrations/20260717000001_full_data_model.sql
supabase/migrations/20260717000002_harden_functions.sql
supabase/powersync/setup.sql  supabase/powersync/sync-rules.yaml
packages/sync/package.json  packages/sync/tsconfig.json  packages/sync/tsconfig.build.json
packages/sync/vitest.config.ts
packages/sync/src/{schema,connector,scenarios,activity,ids,index}.ts
packages/sync/src/{schema.test,scenarios.test}.ts
apps/web/next.config.ts  apps/web/package.json  apps/web/.env.example
apps/web/src/app/layout.tsx  apps/web/src/app/login/page.tsx
apps/web/src/components/{providers,auth-status}.tsx
apps/web/src/components/tax/tax-calculator.tsx
apps/web/src/lib/{supabase,powersync,tax-scenario}.ts
apps/mobile/app.json  apps/mobile/package.json  apps/mobile/.env.example
apps/mobile/app/_layout.tsx  apps/mobile/app/login.tsx
apps/mobile/app/(tabs)/{tax,settings}.tsx
apps/mobile/components/{providers,app-lock}.tsx
apps/mobile/lib/{supabase,powersync,tax-scenario}.ts
```

## Next phase, copied verbatim from PRODUCTION_PLAN.md

### Phase 4: Expenses + Budgeting

Estimated effort: 2 sessions.

- Transactions CRUD with fast-entry UX (amount-first keypad on mobile), categories (seeded Indian defaults), accounts, recurring transactions.
- Monthly budgets per category with progress, overspend states.
- Charts: monthly trend, category breakdown, budget vs actual (Dimensions-style).
- CSV import for bank statements (generic mapper, saved mappings per bank).

Exit criteria: track a real month of expenses end to end on mobile; briefing written.

Note for the next session: the `accounts`, `categories`, `transactions`, and
`budgets` tables already exist with RLS and are in `AppSchema` - Phase 4 adds
domain logic (in `packages/core`), sync-covered already, and UI. Use the same
reactive `useQuery` + repository pattern as `useScenarios`. Remember UPDATE-then-INSERT
(no UPSERT) and that any new jsonb column must be added to `JSON_COLUMNS`.
