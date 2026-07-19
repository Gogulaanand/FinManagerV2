# Decision Log

Append-only log of product and technical decisions.
Newest entries at the bottom.
Format: date, decision, why, alternatives rejected.

---

## D-001: Tax jurisdiction - India first (2026-07-17)

Target Indian tax rules first: old vs new regime, 80C/80D/80CCD, HRA, EPF/NPS, RSU perquisite tax, surcharge + cess, monthly in-hand output.
Why: matches the primary user's situation and the "in-hand amount" framing.
Rejected: US-first; multi-country abstraction upfront (rules are still stored as data files keyed by FY, so other countries can be added later without a rewrite).

## D-002: Mobile via React Native (Expo) + separate Next.js web app (2026-07-17)

True native mobile app through Expo with app-store-grade UX, plus a Next.js web app, sharing business logic through monorepo packages.
Why: user explicitly wants an installed native-feeling app, not a mobile website; PWA limits on iOS were not acceptable.
Rejected: PWA-only (one codebase but weaker mobile UX); Capacitor wrapper (middle ground, but native UX was the priority).
Consequence: roughly 1.5-2x UI effort; mitigated by keeping all domain logic in shared pure-TS packages.

## D-003: Audience - personal + family first (2026-07-17)

Real auth and multi-user support, but optimized for a handful of users on free-tier hosting.
No billing, no marketing pages, no public onboarding.
Why: realistic scope for LLM-agent development under usage limits; can open up later.

## D-004: AI insights are server-side with owner-paid API key (2026-07-17)

A Supabase Edge Function proxies to the Anthropic API with the owner's key; clients never hold the key.
Why: simplest UX for family members; user chose this over BYOK.
Consequence: add a per-user monthly token budget guard to control cost.
Rejected: BYOK (each user pastes their own key).

## D-005: Backend on Supabase, offline-first sync via PowerSync (2026-07-17)

Supabase provides Postgres, Auth, Edge Functions, and pg_cron on the free tier.
PowerSync provides local SQLite on both platforms (expo-sqlite on mobile, wa-sqlite on web) with bidirectional sync.
Why: offline-first is a hard requirement for privacy and speed; this is a documented, supported combo; zero ops at family scale.
Rejected: custom sync from day one (kept as documented fallback in packages/sync if PowerSync free tier becomes a problem); WatermelonDB (weak web story); ElectricSQL (less mature Supabase integration at decision time).

## D-006: Monorepo with pnpm + Turborepo, domain logic as pure TS packages (2026-07-17)

Layout: apps/web, apps/mobile, packages/core (tax, XIRR, FIRE, projections), packages/schema (zod), packages/sync, packages/tokens.
Why: pure functions with exhaustive Vitest suites are the most reliable and token-efficient thing an LLM agent can build; UI phases then consume pre-tested logic.

## D-007: Session and phase protocol for LLM-agent development (2026-07-17)

Phases sized for 1-2 sessions, each ends green and committed.
Session start: read STATUS.md, HANDOFF.md, latest phases/briefing/phase-N.md; do not scan the repo broadly.
Session end: update STATUS.md and HANDOFF.md; phase end additionally writes phases/briefing/phase-N.md.
Why: 5-hour usage windows and weekly limits make cold-start context re-derivation the biggest waste; these files are the warm cache.

## D-008: Web starts on Next.js 16, not Next.js 15 (2026-07-17)

PRODUCTION_PLAN.md specified Next.js 15, but at Phase 0 execution time Next 16.2.10 was the stable `latest` and the 15.x line had moved to a maintenance `backport` dist-tag (15.5.20).
apps/web is pinned to Next 16.2.10 with React 19.2.3 (see D-013 for why React is not on its own latest).
Why: starting a greenfield repo one major behind on a maintenance-only line would have forced a major upgrade a few phases in, for no benefit. App Router and Tailwind v4 (the parts the plan actually depends on) are unchanged.
Decided by the project owner when the discrepancy surfaced.
Consequence: the plan text still says "Next.js 15"; this entry is the correction of record.

## D-009: TypeScript pinned to 6.0.3, not the stable 7.0.2 (2026-07-17)

TypeScript 7.0.2 (the native port) is the published `latest`, but `typescript-eslint@8.64.0` declares a peer range of `typescript >=4.8.4 <6.1.0`, so TS 7 breaks the lint pipeline that every phase must exit green on.
TypeScript 6.0.3 is pinned instead: it sits inside that peer range and is also the version Expo SDK 57 expects (`expo install --check` explicitly asks for `~6.0.3`), so it satisfies both constraints at once.
Why: the lint gate is a hard exit criterion; a toolchain that cannot lint is not a foundation.
Revisit TS 7 when typescript-eslint ships a release that peers it. The pin lives in the root package.json and each workspace package's devDependencies.

## D-010: pnpm uses a hoisted node linker, configured in pnpm-workspace.yaml (2026-07-17)

`pnpm-workspace.yaml` sets `nodeLinker: hoisted`.
Why: Metro (React Native) does not reliably resolve pnpm's default isolated symlink layout. Verified concretely: with the isolated linker, `expo export` failed to resolve `whatwg-fetch` from `@expo/metro-runtime`; with hoisting it bundles clean.
This setting MUST live in pnpm-workspace.yaml. It was first written to `.npmrc` as `node-linker=hoisted`, which pnpm 11 silently ignores - `pnpm config get node-linker` returned `undefined` and installs stayed isolated with no warning. The `.npmrc` has been deleted so it cannot mislead a future session.
Consequence: loses pnpm's strict dependency isolation, so a package can import something it did not declare. Accepted because a working mobile bundler is worth more than that guard at this scale.

## D-011: ESLint pinned to 9.39.5, not 10 (2026-07-17)

ESLint 10.7.0 is the published `latest`, but `@typescript-eslint/scope-manager@8.64.0` does not implement `addGlobals`, an API ESLint 10 calls whenever a config declares globals on a TypeScript-parsed file.
apps/web hit this immediately (`TypeError: scopeManager.addGlobals is not a function`); the pure-TS packages did not, because they only exercise the espree parser path.
Why: typescript-eslint 8.64 advertises `eslint ^10` in its peer range but is not actually ESLint 10-ready for the TS parser path, and eslint-config-next depends on typescript-eslint. ESLint 9.39.5 is fully supported by both.
Revisit alongside [D-009]; the same typescript-eslint release will likely unblock TS 7 and ESLint 10 together.

## D-012: ESLint runs without type-aware rules for now (2026-07-17)

Root eslint.config.mjs uses typescript-eslint's syntactic `recommended`, not `recommended-type-checked`.
Why: type-aware linting across a monorepo needs project-service wiring that is fragile to set up before the packages hold real logic; Phase 0's job is a green, trustworthy pipeline.
Type-only import discipline is instead enforced by the compiler via `verbatimModuleSyntax` in tsconfig.base.json. A `consistent-type-imports` lint rule was tried and removed: it silently requires type information and so contradicts this decision.
Revisit in Phase 2, when packages/core carries the tax engine and type-aware rules start earning their cost.

## D-013: React pinned to 19.2.3 across both apps (2026-07-17)

React and react-dom are pinned to 19.2.3 in apps/web and apps/mobile, though 19.2.7 is published.
Why: Expo SDK 57 expects exactly 19.2.3, and 19.2.3 satisfies Next 16's `^19.0.0` peer range, so one version serves both. Under the hoisted linker (D-010) both apps share a single physical React copy, so they cannot disagree - React must be a workspace-wide decision, not a per-app one.
Consequence: any future React bump has to clear Expo first. `npx expo install --check` in apps/mobile is the authority.

## D-014: Money is a floating-point number of rupees, with mandatory rounding (2026-07-17)

Monetary amounts are JS `number` values in major units (rupees), validated by `MoneySchema` (packages/schema) and rounded to whole paise by `roundToPaise` (packages/core).
This was implicit in the Phase 0 placeholder code; recorded here explicitly because the tax engine (Phase 2) and XIRR/aggregations (Phase 5) bake the representation in deeply.
Rule: every aggregation or rate calculation (sums, interest, tax slab math, XIRR cash flows) must pass through `roundToPaise` before being stored or displayed; never store unrounded intermediate results.
Why: decimal rupees keep rate math and display conversion simple, and with the rounding rule the drift risk is contained; XIRR and projections are approximate by nature anyway.
Rejected: integer paise (safer against drift, but makes every percentage calculation and display conversion noisier). Revisit only if Phase 5 aggregation tests show real drift.
Consequence: `roundToPaise` is paise-accurate up to about 1e10 rupees (1,000 crore) due to its `toPrecision(12)` float correction; fine for personal finance.

## D-015: gain is emerald-700, not the emerald-600 the design system names (2026-07-17)

`color.light.gain` in packages/tokens is `#047857` (emerald-700), though the Stitch design system and its generated screens both specify `#059669` (emerald-600).
Why: emerald-600 scores 3.77:1 on white and fails WCAG AA for text. Gain and loss are not decorative - they encode whether money came in or went out - so they are held to the 4.5:1 text threshold, not the 3:1 non-text threshold. The contrast suite in `packages/tokens/src/color.test.ts` computes the real WCAG ratio and caught this before any screen was built.
Consequence: the token value deliberately diverges from the Stitch asset. packages/tokens is the source of truth for the apps; Stitch remains the design reference. Do not "correct" the token back to match Stitch.
Related: gain (#047857) and loss (#E11D48) sit ~1.17:1 apart in luminance, so they are indistinguishable in greyscale and to a red-green colorblind user. That is not fixable in the palette, and is why the design system requires a sign or a ▲/▼ glyph on every amount. The `Amount` and `Delta` components on both platforms enforce it.

## D-016: mobile uses Tailwind v3 + NativeWind 4, web uses Tailwind v4 (2026-07-17)

apps/web is on Tailwind 4.3.3; apps/mobile is on Tailwind 3.4.19 with NativeWind 4.2.6. Two Tailwind majors coexist in the workspace.
Why: stable NativeWind (4.2.6, published 2026-06-22) targets Tailwind v3. The only line supporting Tailwind v4 is NativeWind 5.0.0-preview - and its most recent preview predates the stable 4.2.6 release, so the preview line is moving slower than stable. Putting a preview dependency under a nine-phase app contradicts [D-009]/[D-011]/[D-013].
This is a build-tooling split, not a design split: both apps generate their theme from packages/tokens, so they cannot drift visually. Web imports `@finmanager/tokens/tokens.css` (v4 `@theme`); mobile imports the generated `nativewind.css` plus `nativewind-theme.cjs`.
Consequence: pnpm resolves Tailwind 3 at the workspace root and nests 4.3.3 under apps/web. A few v4-only utilities do not exist on mobile. `apps/mobile/global.css` must import via `@finmanager/tokens/dist/...`, not the package's export subpath: Tailwind v3 resolves `@import` through postcss-import, which ignores the `exports` field. Tailwind v4 honours exports, so web uses the tidier specifier.
Revisit when NativeWind 5 reaches stable.

## D-017: tailwind-merge is configured with the token type scale (2026-07-17)

`cn()` in apps/web uses `extendTailwindMerge`, fed the token names from `@finmanager/tokens`.
Why: tailwind-merge only knows Tailwind's stock scales. Given a custom scale it read `text-display-lg` and `text-foreground` as two members of one `text-*` group and silently dropped the font size, rendering every currency figure at 16px instead of 40px. Nothing caught it - types, lint, and tests were all green; it was only visible on screen.
Consequence: any new `--text-*` or `--font-*` token is picked up automatically because the config reads the token objects rather than restating the scale. A stray `text-*` utility being dropped is the signature of this bug returning.

## D-018: the tax engine ships FY 2026-27 only, under the Income-tax Act, 2025 (2026-07-17)

PRODUCTION_PLAN.md scoped Phase 2 to FY 2025-26 and FY 2024-25. Both were researched and confirmed, then dropped: the project owner chose to carry only the live year, FY 2026-27.
Why: a personal finance app computing an in-hand salary is answering "what do I take home now". Two historical years would have been dead weight with a maintenance cost and no reader.
This surfaced a fact the plan predates: **FY 2026-27 is the first year governed by the Income-tax Act, 2025 (Act 30 of 2025), which repealed the 1961 Act on 1 April 2026.** Section numbers therefore differ from every pre-2026 reference: the new regime is s.202 (was 115BAC), the rebate is s.156 (was 87A), and "assessment year" no longer exists - the Act uses a single "tax year".
Consequence: any future session adding an older year must add it as a _1961 Act_ rule set, not by copying the 2026-27 table backwards. `FinancialYearRules.statute` exists to carry that distinction and `rules.test.ts` pins it.
Rejected: also shipping 2025-26 and 2024-25 (researched and confirmed this session; the numbers are in the session history if ever wanted).

## D-019: tax rules are data with per-rule citations, sourced only from the statute (2026-07-17)

`packages/core/src/tax/rules.ts` holds every slab, threshold and cap as a data table with a source comment. The engine in compute.ts names no financial year at all; a new year is a new entry in `RULES`.
The FY 2026-27 values were taken from the Finance Bill 2026 text (First Schedule Part I-B and Paragraph F, read directly from the PDF on indiabudget.gov.in) and from incometax.gov.in - not from any third-party calculator.
Why: an existing open-source calculator was offered as a shortcut for the maths. It was checked and rejected - it carried a 50,000 standard deduction (the new-regime figure has been 75,000 since the Finance (No.2) Act 2024), pre-2024 capital gains rates of 15%/10%, and 1961 Act section numbers, all while being labelled FY 2026-27. Every one of those errors is invisible in a green pipeline and surfaces only on a filed return.
Two errors were also found in _official_ material, which is why two sources are the minimum here: incometax.gov.in's AY 2025-26 page renders the new-regime 87A rebate as 20,000 (it is 25,000) and its new-regime surcharge cap as 37% (it is 25%); the "New vs Old Regime FAQs" PDF still states a 50,000 standard deduction for both regimes. The Act text wins.
Consequence: rules.test.ts asserts the headline values against their sources, so a careless edit has to argue with a test. compute.test.ts's expected numbers were hand-computed from the statute before the engine was trusted - two failed on first run and both turned out to be arithmetic errors in the test, not the engine, which is exactly what deriving them independently is for.

## D-020: mobile scenarios persist via AsyncStorage until Phase 3 (2026-07-17)

`@react-native-async-storage/async-storage` 2.2.0 was added to apps/mobile (via `npx expo install`, so SDK 57 chooses the compatible version) to persist tax scenarios. Web uses localStorage.
Why: Phase 2 requires scenarios to survive a relaunch and to work offline and before login, but Phase 3 owns the real data layer. AsyncStorage is the standard Expo key-value store and is a few lines to remove.
Both `lib/tax-scenario.ts` copies (web and mobile) are deliberate duplication, like `sample-data.ts` before them, and both die in Phase 3 when packages/sync owns local storage and scenarios attach to an account. Persistence sits behind a small module boundary in each app precisely so that swap does not touch a component.
Rejected: expo-sqlite (Phase 3 brings it via PowerSync; standing up a schema now would conflict with that design); in-memory only (fails the phase requirement).

## D-021: mobile PowerSync uses the SQL.js adapter to stay in Expo Go (2026-07-18)

Phase 3 wires PowerSync on mobile with `@powersync/adapter-sql-js` (`SQLJSOpenFactory`), not the recommended native `@powersync/op-sqlite`.
Why: the native adapters are native modules and **cannot run in Expo Go** - they need a custom dev build (`expo prebuild` + `expo run:ios`/EAS). Every prior phase, and this environment's verification loop, runs on Expo Go. The owner chose (after a concept walkthrough) to keep the Expo Go loop now and defer the production adapter. At personal/family scale the perf gap is imperceptible.
`packages/sync` is adapter-agnostic (the app injects the DB factory), so the swap to OP-SQLite is localized to `apps/mobile/lib/powersync.ts`.
Caveat: the sql-js adapter is **in-memory by default** (alpha, dev-only) - mobile local data re-syncs from Supabase rather than persisting across relaunch, and has no crash-durability. Acceptable for the dev loop; the OP-SQLite swap (with SQLCipher at-rest encryption) is the Phase 9 hardening task, at which point the `Constants.executionEnvironment` adapter-switch pattern lets Expo Go and dev builds coexist.
Rejected: OP-SQLite dev build now (abandons Expo Go for every future mobile phase, and is unverifiable in this no-touch simulator).

## D-022: PowerSync client schema is data-typed for SQLite, and its tables are views (2026-07-18)

`packages/sync/src/schema.ts` mirrors the 13 Postgres tables with three forced mappings: Postgres `boolean` -> `column.integer` (0/1), `timestamptz`/`date`/`jsonb` -> `column.text`, and `double precision` (money, D-014) -> `column.real`. The `id` (uuid) is never declared - the SDK creates it as text.
Two gotchas cost time and are pinned by `schema.test.ts` and the connector:

1. **PowerSync exposes each table as a SQLite view**, so `INSERT ... ON CONFLICT` (UPSERT) fails with "cannot UPSERT a view". `saveScenario` does UPDATE-then-INSERT instead. This only surfaced in the browser E2E, not in typecheck/lint.
2. **jsonb columns round-trip as text on the client**, so the connector's `uploadData` must `JSON.parse` them before writing back or PostgREST rejects a JSON string where it wants an object. `JSON_COLUMNS` lists them (`tax_scenarios.input`, `activity_log.metadata`, `holdings.metadata`, `goals.linked_holding_ids`).

## D-023: synced scenarios require sign-in; the offline calculator does not (2026-07-18)

The tax calculator runs fully signed-out (compute is offline, the plan's hard requirement). But **saving a named scenario now requires an account**: every `tax_scenarios` row is RLS-scoped to a `user_id`, so there is no anonymous owner to attach one to. The UI gates the save controls on `canSave` (signed-in) with an inline prompt.
The old localStorage/AsyncStorage scenario stores are deleted (both `lib/tax-scenario.ts` copies now just bind the shared `@finmanager/sync` model to a reactive `useQuery`). No runtime migration of pre-existing local scenarios was written - at family scale the data is negligible, and carrying a one-off importer forward is not worth the maintenance.
Rejected: PowerSync local-only tables that promote to synced on login (real offline-anonymous persistence, but materially more complex; revisit if anonymous scenario-saving is ever wanted).

## D-024: RLS proven at the PostgREST layer; email confirmation is unresolved (2026-07-18)

RLS isolation is verified by the real enforcement path, not by reading the policy: as the non-privileged `authenticated` role with a second user's JWT claims, a user reads 0 of another's rows and is blocked by the WITH CHECK policy from forging a row as them. Supabase security advisors are clean (function `search_path` pinned, the `handle_new_user` trigger's RPC EXECUTE revoked).
Open item for Phase 9: **Supabase email confirmation is still ON and the built-in mailer is rate-limited**, so real signups cannot complete (the built-in mailer 429s, and the owner's "Confirm email" toggle did not take effect). Phase 3's web E2E confirmed the one test account via a direct `email_confirmed_at` update. Production needs a real SMTP/Resend sender (Resend is already the planned email provider) or a deliberate decision to disable confirmation.

## D-025: Expense amounts are always positive and direction carries meaning (2026-07-18)

`Transaction.amount` and `Budget.amount` are strictly positive rupee values. A transaction's `direction` is `debit` or `credit`, and summaries calculate net cash flow from that direction.
Why: the amount-first keypad, bank CSV imports, budget ratios, and signed display all have one unambiguous representation. Negative amounts would make debit/credit imports and overspend math easy to invert.
Consequence: UI displays can show signed debit values, but persisted rows and domain inputs never do.

## D-026: Portfolio events use signed cash flows and dated FX (2026-07-18)

Portfolio event amounts are signed cash flows: buy, contribution, and exercise are negative; sell, dividend, interest, and withdrawal are positive; vest is a non-cash event with zero or positive informational amount. Every non-INR event and valuation carries its own dated `fxRateToInr` rather than using a current or static conversion.
Why: XIRR must measure the user's actual cash movement, while foreign holdings and RSUs need historical conversion at the event/valuation date. A single sign convention and explicit missing-FX state prevent plausible-looking but wrong returns.
Rejected: deriving signs from UI labels, treating vest as an investment outflow, and applying one current FX rate to all history.

## D-027: Manual portfolio values always outrank automatic quotes (2026-07-18)

Portfolio display precedence is latest valuation, manual total override, manual price override, automatic quote, then legacy current value/price. Automatic quote refresh writes only automatic price/provenance fields and never replaces manual fields.
Why: manual valuations are authoritative for assets without reliable market prices and must remain stable after an online refresh.
Rejected: replacing manual values with the latest provider response or making quote refresh a no-op.

## D-028: Portfolio completeness is explicit and net worth includes account balances (2026-07-18)

The portfolio summary includes synced account balances, treats credit-card balances as liabilities, excludes an account already represented by a cash holding to avoid double counting, and reports missing valuation/FX as incomplete rather than silently coercing them to zero.
Why: the Phase 5 headline is net worth, not just securities value, and users need to know when it is only a partial view.
Rejected: showing a falsely precise total or counting a linked cash balance twice.

## D-029: Import deduplication is semantic and transactional (2026-07-18)

Zerodha, CAMS, and KFintech parsers live in `packages/core`; import identity hashes normalize provider, account, instrument, date, kind, quantity, price, amount, and currency. Repository commit resolves IDs and performs updates/inserts in one local PowerSync transaction.
Why: row position and presentation formatting are not stable identity, and partial imports leave financial history difficult to repair.
Rejected: UI-only parsing, row-index hashes, and independent per-row writes.

## D-026: Recurring transactions materialize as concrete deterministic rows (2026-07-18)

The saved recurring transaction is the source row. Future occurrences are concrete child rows keyed by `${recurringId}:${YYYY-MM-DD}` in `occurrence_key`; materialization skips keys already present and advances `recurrence_generated_through`.
Why: every device can converge on the same ledger rows after offline edits and reconnects, and charts/budgets can use the ordinary transaction query without a second virtual-transaction model.
Consequence: occurrence generation is idempotent and month-end clamped in `packages/core`; background catch-up can be extended later without changing the entity contract.

## D-027: Bank CSV mappings live in synced profile JSON and imports deduplicate by canonical hash (2026-07-18)

Each bank mapping stores its column-to-field map in `profiles.csv_mappings`, which is mirrored in `JSON_COLUMNS` and synced through the existing profile row. Imported rows carry a canonical account/source-row/date/description/merchant/amount/direction hash.
Why: mappings are user preferences rather than ledger entities, while the hash is stable across repeated imports of the same statement and source-row identity prevents two legitimate identical-looking rows in one statement from collapsing into one transaction.
Consequence: CSV preview requires a real account selection, and repository import reports created, skipped, and failed rows.

## D-028: Account balances remain manual snapshots in Phase 4 (2026-07-18)

`accounts.current_balance` is edited as a user-provided balance and is not recalculated from transaction rows.
Why: bank statements, pending transactions, transfers, and opening balances make a derived balance ambiguous without a reconciliation model that is outside Phase 4.
Consequence: Phase 5/9 may add reconciliation or balance-history behavior, but Phase 4 never silently overwrites the user's account snapshot.

## D-029: Web PowerSync provider is browser-only during SSR (2026-07-18)

The web `AppProviders` component is loaded through `ClientProviders` with SSR disabled. The production build previously emitted repeated `a.execute is not a function` traces while PowerSync attempted to initialize its browser database during static prerender.
Why: wa-sqlite is a browser-only runtime; an SSR no-op flag did not prevent the SDK initialization path from touching the wrong database shape.
Consequence: the server renders static shells, while PowerSync initializes only in the browser where the existing reactive query/repository path is valid.

## D-030: Supabase migration history was normalized before applying Phase 4 (2026-07-18)

The linked project had the Phase 3 migrations applied under dashboard-generated timestamps (`20260718024023` and `20260718024101`), while the repository carried the equivalent canonical files as `20260717000001` and `20260717000002`.
Why: Supabase refuses to push a local migration while remote history contains versions absent from the local directory. The remote inventory, migration names, table set, and Phase 4 preflight were checked before the history was reconciled.
Consequence: the remote history now matches the repository, and `20260718000001_phase4_expenses.sql` applied cleanly. Future `supabase db push --linked` runs can use the committed migration sequence directly.

## D-031: recurrence catch-up advances by month-end and generated rows are not sources (2026-07-18)

Recurring sources are materialized through the selected month's final calendar day. The source watermark is that concrete date; generated occurrences keep the recurring ID and occurrence key but clear recurrence metadata and `isRecurring`.
Why: changing months must expose all expected rows, including a source saved before the selected month, while editing a generated row must never fork or mutate the schedule. The watermark also prevents a deleted prior occurrence from being recreated during a later catch-up.
Consequence: `ensureRecurringThrough` runs from both clients through the shared repository, and recurrence behavior is covered by the sync integration suite.

## D-032: Phase 4 write flows are parity-first across web and mobile (2026-07-18)

Accounts, categories, transactions, budgets, confirmations, and charts are available on both clients and call the same PowerSync repositories. Mobile keeps the amount-first keypad, while its setup and budget forms use the shared Zod contracts.
Why: cross-device sync is only useful if either client can complete the real monthly ledger flow; a read-only mobile budget card would leave the feature incomplete.
Consequence: interactive mobile verification still requires a real Expo Go device because the local simulator has no touch input, but the code path and native iOS bundle are checked in CI.

## D-033: saveTransaction uses SELECT-check-then-INSERT because callers pre-assign UUIDs (2026-07-18)

`useExpenses` (and analogous hooks) call `uuidv4()` before passing the transaction to `repoSaveTransaction`, so `transaction.id` is always truthy.
The original `isNew = !transaction.id` guard was therefore always `false`, turning every new-row write into an UPDATE against a nonexistent row - a silent no-op.
Fix: `saveTransaction` now runs `SELECT id FROM transactions WHERE id = ? LIMIT 1` first and branches on the result rather than on the presence of an id field.
Why: the pre-assignment pattern is load-bearing (the UI needs the id before the write resolves), so the check must move to the database layer.
Consequence: every insert path pays one extra SELECT; acceptable at personal-finance write frequency.
The sync tests were updated: `fakeDb` gained `existingTransactionIds` and the existence-check SELECT is now differentiated from the import-hash SELECT by `WHERE id = ?` in the SQL.

## D-034: PowerSync offline writes require an unexpired Supabase auth token (2026-07-18)

PowerSync's `fetchCredentials` calls `supabase.auth.getSession()` to obtain a JWT for the sync endpoint.
When the network is blocked before the token refreshes, `getSession()` cannot reach the refresh endpoint and the write path errors.
Safe offline simulation sequence: restore network, wait for the token to auto-refresh (Supabase refreshes at roughly 60 seconds before expiry), then block the network.
Why: PowerSync's credential fetch is on the hot path for every local write, not just for sync upload; even purely local inserts fail if the credential promise rejects.
Consequence: offline E2E tests must allow a token-refresh window before enabling the offline block.

## D-035: Phase 6 goals reuse the pre-scaffolded schema; only app/core/sync layers were new (2026-07-18)

The `goals` and `fire_settings` Postgres tables (with RLS, indexes, and the updated-at trigger) already existed in `20260717000001_full_data_model.sql`, and the PowerSync client schema plus `JSON_COLUMNS` (`goals.linked_holding_ids`) were already declared. Phase 6 therefore added no migration and no schema-table changes; it added the Zod contracts, the `packages/core/goals` engine, the sync repositories, and the web/mobile UI.
Why: the data model was designed up front in Phase 0/3, so the offline-first contract and RLS were already correct; re-declaring them would risk drift.
Consequence: goal money and rates follow the same float-rupee/whole-percentage conventions as the rest of the app, and `saveGoal` uses the `isNew = !input.id` branch safely because the goal forms (unlike `saveTransaction`, see D-033) do not pre-assign UUIDs. `fire_settings` writes use UPDATE-then-INSERT keyed on the unique `user_id`.

## D-036: goal and FIRE math live entirely in packages/core and target today's rupees (2026-07-18)

Goal projections inflate the target to its date and grow current funding at the expected return; FIRE projections discount with a real (inflation-adjusted) return so the FIRE number, coast number, and years-to-FIRE are all expressed in today's rupees. Linked-holding values reuse the portfolio engine's `effectiveHoldingValue` precedence, and the FIRE expense baseline is auto-suggested from the trailing 12 months of debit transactions until the user saves an explicit value.
Why: keeping all business math in core (UI never computes) is a hard project rule, and a single real-return convention avoids mixing nominal and real figures across the FIRE variants.
Consequence: the engine is exhaustively unit-tested (core +28 tests); the UI only formats. Required SIP is an ordinary-annuity solve, and unreachable FIRE (no growth, no savings) returns a null months-to-FIRE rather than infinity.

## D-037: monthly investment is user-settable and the FIRE required-SIP uses the real return (2026-07-19)

FIRE now derives "monthly savings" from the explicit `fire_settings.monthly_investment` when set, falling back to the transaction-derived rate (average of trailing months' credits minus debits, floored at zero). A new `requiredMonthlyContribution` on the FIRE projection solves the SIP that grows the current corpus into the FIRE number by the retirement age, and `contributionGap` is that required SIP minus the current monthly savings.
Why: the derived rate reads 0 whenever a user logs expenses but no income (the common case early on), which is correct but unhelpful; an explicit field makes the input visible and controllable and feeds the required-vs-actual comparison the user asked for. The required-SIP solve uses the same real (inflation-adjusted) monthly rate the rest of the FIRE engine uses, because the FIRE number is expressed in today's rupees - solving with the nominal expected return would understate the SIP needed to hit a target that itself inflates. The horizon is years-to-retirement (`retirementAge - currentAge`), so the required SIP is null until both ages are set.
Consequence: added `monthly_investment double precision` to `fire_settings` (migration `20260718000003`, applied to `vkivzhbckfsjtvzatuiz`) and to the PowerSync client schema; schema/sync/core/UI on both platforms carry the field. The number shown is a today's-rupees SIP, not a nominal one.
