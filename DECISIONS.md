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

## D-038: data-querying workspaces mount only after the first PowerSync sync (2026-07-19)

The Goals workspace is split into an outer gate (`GoalsWorkspace` / mobile `GoalsScreen`) that reads only `useStatus()` + auth, and an inner component (`GoalsWorkspaceContent` / `GoalsContent`) that owns the `useQuery` hooks. The gate holds the skeleton until `status.hasSynced` is true (signed-out users skip the wait), so the queries mount against a populated local DB.
Why: `db.connect()` only runs after `onAuthStateChange` resolves the session, which is after the page first mounts. Queries mounted during that initial-connect window attach to an empty local DB, resolve to `[]`, and render zeros - and the live queries do not re-emit the rows that stream in afterwards, so only a remount (e.g. navigating away and back) fixes it. Gating render (an early `if (loading)` return) is not enough because the hooks still mount; the mount itself must be deferred.
Consequence: headline FIRE tiles and stored FIRE settings render correct values on first load. The same first-load-zeros pattern still exists latently in the Portfolio and Expenses workspaces (they are entered after sync in practice); apply the same split there if it surfaces.

## D-039: expense pagination uses a growing live-query LIMIT (2026-07-19)

Month transaction lists use one month-bounded PowerSync live query whose LIMIT grows by 50, plus a separate month count query. OFFSET pages are rejected because a live insert at the top would shift offsets and cause duplicates or omissions. The six-month unbounded window remains the source for trends and full-month aggregates, so list pagination cannot flatten charts or undercount summaries.

## D-040: mobile expenses use one owning FlatList, not FlashList or nested scrolling (2026-07-19)

The transaction `FlatList` owns the entire expense screen scroll; summaries and controls are its header, while budgets, collapsed Accounts/Categories, and charts are its footer. Hundreds of simple monthly rows do not justify a new FlashList native dependency, and a nested max-height list would compete with the outer gesture in Expo Go.

## D-041: portfolio navigation is holding-centric via dedicated routes (2026-07-19)

Web uses `/portfolio/[holdingId]` and mobile uses `/holding/[id]` as a sibling root Stack screen. The hubs are summaries and launch points; holding detail owns edit, contextual event/value actions, and the merged timeline. Expandable hub panels were rejected because they retain the original form-heavy workspace and make mobile navigation/scroll state harder to understand.

## D-042: global portfolio history UI is retained as dead component code (2026-07-19)

The portfolio hubs no longer import or render the global event form, valuation form, ledger history card, or valuation history card. The form components remain and are reworked for contextual reuse on holding detail; no schema or event-kind capability was removed. This intentionally follows the owner decision to simplify render paths without deleting reusable or potentially recoverable code.

## D-043: Phase 7 uses a client-built digest and a thin authenticated LLM proxy (2026-07-19)

Web and mobile assemble the scoped financial digest from their local PowerSync data using shared core analytics, then send only that compact digest to the authenticated `ai-insights` Edge Function. The function verifies the Supabase JWT, supplies the grounded Indian-personal-finance system prompt, enforces the monthly token allowance, holds the Anthropic key, and proxies SSE bytes. It does not independently reread Postgres.
Why: on-device SQLite is the state the user actually sees, including local offline writes. A server-side financial read would create a second path that can lag or disagree, and putting the Anthropic key in either client would expose the owner-paid credential.
Consequence: AI Insights is the sanctioned direct-network feature alongside auth, but all deterministic financial calculations stay in `packages/core`; the model receives rounded, top-N, scope-filtered facts rather than the raw database.

## D-044: chat is ephemeral; only a monthly health summary syncs (2026-07-19)

User and assistant turns live only in component memory and the request carries at most the last ten turns. Reloading clears the thread. The generated monthly health summary is upserted by user/month/scope into `ai_summaries`, which is private under RLS and included in PowerSync so Dashboard and Insights can render it offline.
Why: persisted free-form financial conversations add privacy, retention, sync, and deletion complexity without improving the primary monthly-health use case.
Consequence: `ai_usage` remains server-written and unsynced, while `ai_summaries` is the only persisted AI content. Offline chat is disabled explicitly rather than pretending a local model exists.

## D-045: Anthropic SSE is parsed once in shared core and assistant text stays plain (2026-07-19)

The Edge Function passes Anthropic SSE through unchanged. Both clients use `createAnthropicSseParser` from `@finmanager/core` to handle frames split across arbitrary network chunks; web uses native streaming fetch and mobile uses `expo/fetch`. Assistant text renders as quiet, whitespace-preserving prose rather than dependency-heavy Markdown.
Why: one tested incremental parser prevents platform drift, while plain prose meets the current answer format without adding a renderer or accepting model-produced HTML.
Consequence: Expo Go must verify streaming interactively. A mobile-only non-streaming fallback is allowed only if the observed failure is recorded first.

## D-046: mobile navigation keeps Insights visible in a five-slot tab bar (2026-07-19)

The visible mobile tabs are Dashboard, Expenses, Portfolio, Insights, and More. More opens a bottom sheet using existing tokens and routes to Tax, Goals, and Settings; those routes remain real and deep-linkable but have `href: null` in the tab bar.
Why: seven visible tabs forced unreadably small labels, while Insights must remain a first-class destination.
Consequence: tab labels return to the shared label typography token instead of the previous 10px squeeze, and the sheet must be included in light/dark, accessibility, and Expo Go verification.

## D-047: Phase 7 backend deployed to the finmanager project; interactive verification bounded by cost and data (2026-07-19)

Migration `20260719000004_phase7_ai_insights.sql` was applied to Supabase project `vkivzhbckfsjtvzatuiz` (name "finmanager") via MCP, creating `ai_usage` and `ai_summaries` (2 tables, 7 indexes, 2 RLS policies, RLS enabled, no new security-advisor findings). The `ai-insights` Edge Function was deployed (v1, ACTIVE, `verify_jwt=true`). The owner set `ANTHROPIC_API_KEY` as a Supabase secret and published the PowerSync sync rule (`ai_summaries` in, `ai_usage` out) from `supabase/powersync/sync-rules.yaml`. A cost-free live call proved the deploy: an invalid scope returns HTTP 400 `{"error":"invalid_request", ...}` before any Anthropic request.
Why: Phase 7 could not exit while the backend was undeployed, and deployment target had to be confirmed because the worktree was not locally linked.
Consequence: Phase 7 stays In Progress. The owner directed that NO AI Insights test may trigger a real Anthropic call (cost), so the grounded-answer, scope-isolation, ephemeral-reload, summary-persistence, offline-cached-summary, and usage-accounting scenarios are deferred and were not run. The Phase 7 UI surface (workspace, scope picker with all six scopes, suggested prompts, ephemeral notice, composer, light/dark, 400 validation) was verified cost-free on Chrome.

## D-048: Phase 5.3 Chrome structural verification done; scale/offline scenarios blocked by empty test data (2026-07-19)

On Chrome with the signed-in web test account, the holding-centric flow was verified live: the portfolio hub has no always-open forms and routes to `/portfolio/<id>`; the detail route shows header/effective value/XIRR/edit plus collapsed Add-event and Update-value forms and a merged newest-first timeline; an added "Invested more" event saved as a correctly-signed -₹5,000 outflow and deleted per-entry; the Add-event kind list for a stock is exactly Invested more/Sold/Dividend received; Edit holding uses typed fields with no raw JSON, and switching Asset type to RSU reveals a typed "RSU grant" metadata card. The expenses screen shows the "X of Y this month" count and a 6-month trend window.
Why: to confirm the Phase 5.3 UX simplification behaves as specified end-to-end.
Consequence: the whole database holds only 6 transactions (0 for the signed-in user) and 1 holding, so the 100+ transaction load-more scale (scenarios 6-7), the offline write/reconnect path (scenario 8), and the USD/RSU event-form FX display (scenario 3) could not be exercised live. The growing-LIMIT pagination those cover is verified by `packages/sync/src/expenses.integration.test.ts` (seeds ~120 rows). Phase 5.3 stays In Progress; full closure needs seeded data, the offline path, and Expo Go.

## D-049: Amount count-up must converge on async value changes (2026-07-19)

`apps/web/src/components/amount.tsx` animated its display via `gsap.matchMedia()` with `useGSAP({ revertOnUpdate: true })`. When the `value` prop changed after mount - the offline-first default, where a card mounts at 0 and PowerSync hydrates the real figure a beat later - the revert path left `displayValue` stuck at its initial mount value. Interactive Chrome verification caught the web Expenses summary cards (Spent/Income/Net cash flow) rendering ₹0 while React state held the real total (debit 6441 on a 9-row month, and 68941 on the 120-row seed). The fix drops matchMedia/revertOnUpdate for a plain `gsap.fromTo` keyed on `[value]`, skips the tween when it would be a no-op or under reduced motion (setting the exact value immediately), and adds `onComplete` so the final frame is the precise value. Verified: the summary now animates 0 -> 6441 and lands exactly, and the reduced-motion path shows the exact figure with no animation.
Why: a core money figure silently reading zero is a correctness failure, not a cosmetic one.
Consequence: the mobile `Amount` (reanimated, keyed on `[value]` via useEffect) was already correct and unchanged. This was a Phase 1 design-system defect surfaced by Phase 5.3 routing the summary through the async window query; fixed cross-phase per the house "fix it when you see it" rule.

## D-050: post-Phase-7 re-prioritization and staged monetization stance (2026-07-19)

The owner declared phases 0-7 complete and re-ordered the remaining work: the two carried-over UX items (mobile add/edit modal routes, expenses month/year navigation) jump ahead of Phase 8, and five detailed plan docs now live in `phases/plans/` (UX navigation, Phase 8, Phase 9, monetization, improvements backlog).
Key calls made in those plans: form routes use `presentation: 'card'` because the requirement is edge-swipe-back (iOS modal presentation dismisses by swipe-down); the dead-man escalation state is derived from `activity_log` + `escalation_events`, never stored as a mutable status; Resend is built in Phase 8a and shared with the D-024 auth-email fix; monetization is staged - donations (Razorpay link, nothing gated) after Phase 9, subscriptions only if roughly 50+ external MAU or repeated willingness-to-pay appears, and the dead-man switch stays free permanently.
Why: entitlement/payment code is pure liability at zero external users, and the app's honest moat (privacy custody + dead-man switch + unified India engine) serves a narrow audience that convenience-first AA incumbents already serve for free.
Rejected: building subscriptions now; donations-only forever (the trigger keeps the door open); paywalling any safety feature.

## D-051: AI allowance reservations use a shared atomic RPC (2026-07-21)

AI requests reserve an input estimate plus the model output ceiling through `record_ai_usage` before opening the Anthropic stream, then settle the reservation to observed usage when the stream ends or is cancelled. The RPC performs the budget predicate and `INSERT ... ON CONFLICT DO UPDATE` in one statement family.
Why: a read-before-stream check and a post-stream increment allow concurrent requests to pass the same stale allowance and undercount usage. Reservations make the budget gate and increment indivisible while settlement avoids charging the maximum ceiling when the real response is smaller.
Consequence: the migration must be deployed before the updated Edge Function; service-role execute is granted only to the function path, and `ai_usage` remains server-written and unsynced.

## D-053: AI usage settlements update existing reservations atomically (2026-07-21)

The settlement branch of `record_ai_usage` uses a guarded atomic `UPDATE` for negative deltas. A negative insert cannot reach `ON CONFLICT` because the `ai_usage` nonnegative check constraints reject it first.
Why: streamed requests commonly settle below their reserved ceiling, and cancellation releases the reservation; both paths must preserve the table constraints while remaining race-safe.
Consequence: migration `20260721000002_fix_ai_usage_settlement.sql` is applied locally and remotely. The linked test verified eight concurrent reservations (`80/160/8`) and an atomic release to zero.

## D-052: Component audit keeps referenced contextual forms (2026-07-21)

The improvements pass extracted oversized setup and metadata sections into focused components. The remaining contextual holding-event and valuation forms were retained because route/detail references still use them; no unreferenced component was deleted.
Why: deleting only files proven unused avoids breaking deep-link and detail-route flows while still reducing the largest component surfaces.
Consequence: the audit result is recorded here, and future cleanup should re-run reference search before removing those forms.
This supersedes the deletion assumption in D-042; D-042 remains historical context for why the global history render paths were removed, not an instruction to delete the still-referenced contextual forms.

## D-054: Phase 8 cron configuration requires Vault prerequisites (2026-07-23)

The Phase 8 migration reads `deadman_supabase_url` and `deadman_cron_secret` from Supabase Vault at schedule-creation time. It deliberately skips creating `deadman-daily` when either secret is absent, rather than creating a malformed job with an empty URL or header.
Why: the migration must remain safe to apply before deployment secrets exist, while the hosted project can still create a valid schedule after Vault setup.
Consequence: every new environment must provision both Vault secrets, verify `cron.job` contains the active `deadman-daily` schedule, and only then claim cron readiness.

## D-055: Activity marks are refreshed on foreground, not only on mount (2026-07-25)

`logActivity` originally ran once per user id per mounted session, guarded by a ref, and the foreground/visibility handlers only retried a previously failed write.
A session that is never torn down - a backgrounded mobile app, a browser tab left open for days - therefore recorded exactly one `activity_log` row at sign-in and none afterwards.
Because escalation is derived from `max(activity_log.occurred_at)`, that would have escalated all the way to trusted-contact disclosure against a user who was still opening the app daily.
`recordActivityIfStale` now writes a fresh mark on every foreground/visibility transition when the newest local mark is older than `ACTIVITY_INTERVAL_MS` (one hour).
Why: liveness has to be proven repeatedly, and the interval keeps ordinary tab switching from flooding the log while still bounding staleness far below the smallest useful threshold.
Consequence: the freshness check reads local SQLite, so it works offline; a read failure deliberately falls through to writing a mark rather than suppressing one, because a missing mark is the dangerous direction.

## D-056: The escalation guard is scoped to the newest activity mark (2026-07-25)

`hasCurrentEvent` treats a stage as already delivered when its event was created after the newest activity mark, which makes the chain idempotent without a separate state column.
The consequence surfaced during verification: leftover events from an earlier test run suppress a replay, because those rows are newer than any activity timestamp that is also stale enough to be due.
Why: recording this so a future session does not mistake a correctly suppressed replay for a broken cron path.
Consequence: replaying an escalation chain against a threshold of N days requires the staged escalation events to predate the staged activity mark; clear or re-date the ledger first.

## D-057: Timestamp parsing accepts the PowerSync rendering, not only JavaScript ISO (2026-07-25)

`packages/schema` validated every timestamp with `z.iso.datetime({ offset: true })`, which requires a `T` separator.
PowerSync renders a Postgres `timestamptz` as `YYYY-MM-DD hh:mm:ss.sssZ`, and sometimes with a two-digit offset such as `+00`, so strict ISO validation rejects it.
Rows the client writes itself carry `toISOString()` output and parse cleanly, which is why the existing tests passed - they only ever exercised locally written values.
Every `escalation_events` row is written server-side by `deadman-check`, so `mapEscalationEventRows` would have thrown on all of them, and `deadman_settings`/`trusted_contacts` would have thrown once a server round-trip replaced the locally written timestamps. `ai_summaries.generated_at` from Phase 7 had the same latent defect.
`IsoTimestamp` now lives in `packages/schema/src/timestamps.ts` and normalises the PowerSync form before validating; `deadman.ts` and `insights.ts` both use it.
Why: the parser has to accept both formats the app actually produces, and failing closed here means a blank escalation history rather than a caught error.
Consequence: any new schema covering a synced `timestamptz` column must import `IsoTimestamp` rather than redeclaring `z.iso.datetime`, and mapper tests should use the PowerSync shape, not a hand-written ISO string. See https://docs.powersync.com/sync/types#postgres-type-mapping.

## D-058: A cron run that escalates nobody must fail loudly (2026-07-25)

The cron path discarded the error from `admin.auth.admin.getUserById` and skipped any user it could not load.
During the 2026-07-25 replay a transient `bad_jwt` 403 from the Auth admin API made the function return HTTP 200 with `{"processed":0,"results":[]}` - indistinguishable from "no user has the switch enabled".
For a dead-man switch that is the worst available failure mode: no email, no ledger row, no non-2xx for the scheduler to trip on, and the first visible symptom would be a disclosure that never arrived.
The loop now checks the lookup error, wraps `processUser`, logs each skip, and returns HTTP 500 with a `failures` array whenever any enabled user could not be processed. The response also reports `enabled`, `processed` and `failed` counts so a clean run is distinguishable from an empty one.
Why: silence must never be the success signal for a feature whose entire purpose is to act when the user cannot.
Consequence: the daily job's recorded response is now meaningful; a non-2xx there means at least one user was skipped and needs investigation. This does not retry - a transient failure is surfaced rather than absorbed, and the next daily run picks the user up again.

## D-059: Disclosure summaries are presented, not dumped (2026-07-25)

The 2026-07-25 disclosure to a trusted contact read `- account:bank: INR 80,000` and `- stock: INR 0`.
The first leaked `account:${type}`, an internal namespacing key used only to stop holding and account types colliding in one map, into a message sent to a third party. The second listed an asset class whose only holding had no recorded value.
`summaryLabel` and `presentableSummary` in `logic.ts` now map each entry to a human label, drop empty classes, and order by size.
Why: this message reaches someone else at the worst moment of the user's life, and a notice that looks broken undermines the one thing it needs to be - believed.
Consequence: adding a holding or account type requires adding its label; an unmapped type degrades to a humanised form of the key rather than the raw key. Note that `credit_card` balances still count as positive value via the `Math.max(0, …)` clamp, which is worth revisiting before release.

## D-060: Disclosure message templates live in packages/core (2026-07-25)

The disclosure preview called the `deadman-check` Edge Function, which re-read `deadman_settings` from Postgres.
It therefore showed the last value that had been both saved and uploaded by PowerSync - never the unsaved draft, and stale offline or immediately after a save. A user typing a disclosure note and pressing Preview saw the previous note.
That is a network read of data the client already holds, which the offline-first rule in `CLAUDE.md` treats as a bug.
The templates and summary presentation now live in `packages/core/src/deadman/messages.ts`. Web and mobile render the preview on-device from the draft plus locally synced holdings and accounts; the Edge Function imports the same module by relative path and renders the message it actually sends.
Why: a preview that disagrees with the delivered message is worse than no preview, so both paths must share one implementation rather than one copying the other.
Consequence: `messages.ts` must stay free of imports. The Supabase CLI bundles it through Deno by walking the relative import, and Deno cannot resolve the NodeNext `.js` specifiers the rest of `packages/core` uses - adding any import to that file will break the Edge Function deploy, not just its types. The deploy output lists `packages/core/src/deadman/messages.ts` as an uploaded asset, which is the check that this still works.
The function's `preview` action is now unused by both clients but is retained because `test_send` shares its code path.

## D-061: Edge Functions read the migrated API keys first (2026-07-25)

The project is mid-migration to asymmetric JWT signing keys. Supabase imported the legacy HS256 secret into the new system and created an ES256 key, so Auth instances that had picked up the new JWKS began rejecting the legacy `service_role` token with `unrecognized JWT kid <nil> for algorithm ES256` while others still accepted it.
The symptom was an intermittent 403 from `auth.admin.getUserById` during the 2026-07-25 replay: it failed, then succeeded two minutes later, then failed again.
`deadman-check` now reads `SUPABASE_SECRET_KEYS` and `SUPABASE_PUBLISHABLE_KEYS` first, falling back to `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`. The new variables hold a JSON object keyed by name - the default key is `default` - not the plain string the legacy variables held.
Why: left alone this would have taken the dead-man switch down in production, intermittently at first and then permanently once the rotation completed.
Consequence: `ai-insights` still reads `SUPABASE_SERVICE_ROLE_KEY` directly and carries the same exposure; it should adopt the same helper. Nothing yet alerts on the cron's HTTP status, so the 500 introduced by D-058 is correct but still only visible to someone looking.

## D-062: The signup notice never mentions project configuration (2026-07-25)

The post-signup notice read "Account created. If email confirmation is enabled, check your inbox to finish."
That exposes an internal project setting to the user and makes the app sound unsure of its own behaviour.
`signUpWithPassword` already had the answer and was discarding it: `signUp` returns a session when confirmation is disabled and `null` when Supabase has sent a confirmation email. It now returns `{ error, needsConfirmation }`, and the notice appears only when an email was actually sent.
Why: the UI should state what happened, not hedge across configurations the user cannot see.
Consequence: enabling or disabling "Confirm email" changes the copy automatically, with no code change. Note that email confirmation was found disabled on the linked project on 2026-07-25 and re-enabled - unconfirmed signups let anyone register with an address they do not own, so this must be verified before release.

## D-063: The settings form hydrates from the row id, not a loading flag (2026-07-25)

`useState(settings)` captures only the first value. On the first render the PowerSync query has not resolved, so `settings` is the schema default - the form therefore showed defaults permanently, and pressing Save wrote those defaults back over the user's real configuration.
That is data loss with a safety consequence: opening Settings and saving would have silently set `is_enabled` to false while the panel claimed the monitor was off, so a user could believe the switch was armed when it was not. Found during the 2026-07-25 interactive pass, not by any automated test.
The first fix latched on a `loading` flag and was still wrong: the query resolves to an empty array before the row syncs down, so the latch fired against the defaults and never corrected itself. Hydration is now keyed on `settings.id`, which only exists once a real row has arrived. A user with no saved row has no id, so the form correctly keeps the defaults.
Why: the identity of the loaded row is the only signal that distinguishes "no data yet" from "no data at all"; a boolean cannot.
Consequence: any other form seeded from a PowerSync query has the same latent bug. `apps/mobile/components/settings/deadman-settings.tsx` carried it identically and is fixed alongside. Build and typecheck passed against the broken version, so this class of defect needs interactive verification or a test that simulates the empty-then-populated query sequence.

## D-064: Edge Functions authorize in code, with verify_jwt disabled (2026-07-25)

`ai-insights` returned 401 for every request. The user's access token is now `alg: ES256` with a `kid`, confirming the project has migrated to asymmetric JWT signing keys, and the platform's built-in `verify_jwt` gate only understands the legacy HS256 tokens - so it rejected callers before the function body ran.
`ai-insights` already required a Bearer token and validated it with `auth.getUser()`, so the platform gate was redundant with a check the function performs itself. It is now deployed with `verify_jwt = false`, matching `deadman-check`.
Verified by calling the function from the browser with the app's own session token: requests now reach the body and fail only on request-shape validation, with and without an `apikey` header.
Why: the platform gate cannot validate the tokens this project now issues, and the function's own check is strictly stronger because it resolves the user rather than only verifying a signature.
Consequence: `verify_jwt = false` is only safe because every code path returns 401 before doing work when the caller is unauthenticated. Any new function must authorize in code before this setting is copied. Interactive verification of the Insights UI is still outstanding - only the API-level auth path has been confirmed.

## D-065: Dashboard fixtures never represent signed-in account data (2026-07-25)

The web and mobile dashboards continued importing the fixed Phase 1 sample figures after the real data layer existed. A new account therefore appeared to own invented balances, expenses, FIRE progress, and transactions even though no such rows were stored.
The dashboards now derive their figures from the same expenses, portfolio, and goals hooks as the detail screens. The sample-data modules remain fixtures for manual design work and have no production route imports.
Why: presentation fixtures must not be indistinguishable from a signed-in user's financial records.
Consequence: an empty account renders zero and empty states; existing accounts render locally synced data.

## D-066: Default categories are provisioned once by the auth-user trigger (2026-07-25)

`useExpenses` previously ran `seedDefaultCategories` from a React effect. The repository performed a separate existence check and insert for each category, so concurrent mounts created complete duplicate sets. Later mounts also recreated defaults a user had intentionally renamed or deleted.
The existing `on_auth_user_created` trigger now creates the profile and one private set of 21 category rows in the same server-side signup flow. Client hooks never seed categories, and categories have no permanent template key or name uniqueness constraint: after provisioning they belong entirely to the user.
Why: account provisioning is a database lifecycle event, not a screen-mount side effect. Users must remain free to rename, delete, or create similarly named categories.
Consequence: migration `provision_default_categories_once` consolidates exact duplicate system categories per user/name/kind, repoints transaction, budget, and parent-category references, and does not backfill missing defaults for existing users because absence may represent an intentional deletion.

## D-067: Calm Teal application tokens override generated design literals (2026-07-29)

Phase 8.5 uses Stitch for layout and hierarchy exploration, not as a second design-token source.
Manrope remains the display/amount face, Inter remains body text, cards retain the existing 12px
rhythm, semantic light/dark colors stay authoritative, and positive values retain accessible
`#047857`.
Why: generated concepts are useful for composition, but copying literal values would fork the
system and regress existing accessibility decisions.
Consequence: selected Stitch screen IDs and intentional implementation differences are recorded in
`phases/briefing/phase-8.5.md`; no bespoke brand logo or parallel token layer is introduced.

## D-068: Category presentation fallback is semantic and non-migrating (2026-07-29)

New custom categories persist icon `tag` and brand teal `#0F766E`. Existing rows with null or
unknown icon/color values render through the same fallback in shared core; they are not remotely
backfilled. The repository applies the fixed pair only on insert, so editing a legacy row does not
silently rewrite stored presentation.
Why: category identity is financial data, while a missing badge is a presentation concern. A
database backfill would create unnecessary remote writes and could overwrite user-owned legacy
choices.
Consequence: web and mobile use platform-native icon components over the same persisted keys, and
future Phase 9 import paths inherit the insert default through `saveCategory`.

## D-069: Dashboard allocation and charts remain honest, inspectable projections (2026-07-29)

Both dashboard adapters expose `portfolio.summary.allocation`; they never synthesize holdings or
sample figures. Asset-class presentation is deterministic in shared core. Chart meaning is
available through formatted axes, text legends and summaries, status words, and platform-native
inspection: hover/focus tooltips on web and Victory press state plus visible selection text on
mobile.
Why: financial graphics that rely only on color or fabricated demonstration data are inaccessible
and potentially misleading.
Consequence: an account without valued holdings receives an explicit empty state, and Expo export
alone cannot close the native tap/gesture verification gate.

## D-070: Phase 8.5 changes safety and AI comprehension, not their contracts (2026-07-29)

AI Insights retains authenticated Anthropic SSE, ephemeral chat, persisted monthly summaries,
scope filtering, cancellation, and allowance enforcement. Dead-man settings retain PowerSync
hydration, local unsaved-draft preview, Edge Function actions, disclosure semantics, activity
cancellation, and the threshold +0/+7/+14/+21 escalation logic.
Why: this phase exists to improve comprehension before release hardening, not to reopen deployed
backend or delivery behavior.
Consequence: there is no Phase 8.5 schema, Supabase, PowerSync, route, AI API, or dead-man API
migration.

## D-071: Phase 9 E2E data is a dedicated, idempotent account fixture (2026-07-25)

The Phase 9 harness provisions one environment-named Supabase user through the server-only Auth
Admin API, resets only that user's fixture tables, and inserts a deterministic current-month
dataset including 120 transactions. Credentials and the Supabase secret key are environment
variables; none is stored in Playwright, Maestro, CI YAML, or tracked documentation.
Why: critical flows need stable scale and financial data in both web and mobile without borrowing a
real user's account or making tests order-dependent. Reusing one account also exercises the same
PowerSync path as production.
Consequence: the fixture must remain idempotent and user-scoped. Any new destructive reset table
must be reviewed for ownership and foreign-key order. CI must seed before Playwright, and concurrent
runs against the same account are intentionally serialized.

## D-072: Expo Go detection uses `expoGoConfig`, not `executionEnvironment` (2026-07-26)

Expo's `StoreClient` execution environment can represent both Expo Go and a development client in
current SDKs, so it cannot safely choose the database adapter. `Constants.expoGoConfig` is present
only inside Expo Go. Mobile therefore keeps SQL.js when that value exists and runtime-loads
OP-SQLite everywhere else.
Why: evaluating the native OP-SQLite module at import time crashes Expo Go, while classifying a
development client as Expo Go would silently retain the in-memory database.
Consequence: the native import must stay behind the runtime branch. Expo Go cannot be used as
evidence for persistence or SQLCipher.

## D-073: Native database keys are random, device-only, and recoverable by re-sync (2026-07-26)

Custom mobile builds generate a 256-bit-equivalent random hex database key, store it with
SecureStore's device-only after-first-unlock accessibility, and pass it to OP-SQLite's SQLCipher
option. The key is never derived from a password or synchronized.
Why: a synchronized or user-derived key broadens exposure and creates password-rotation coupling.
Consequence: SecureStore loss makes the local database unreadable. The recovery path is to clear app
data or reinstall, create a new key/database, and let PowerSync re-sync server data.

## D-074: Dead-man cron health requires both durable outcomes and an external heartbeat (2026-07-26)

`deadman-check` records enabled/processed/failed counts and detail in `cron_runs` after every
authenticated cron invocation. A separately scheduled `deadman-monitor` alerts the owner for a
failed or stale latest row, while a clean run optionally pings an external heartbeat.
Why: the internal monitor catches ran-but-failed outcomes, but no component inside the same
Supabase project can detect that the project, scheduler, or function did not run at all.
Consequence: the heartbeat URL is optional in code but mandatory for release. Heartbeat failures
are logged without converting a clean escalation run into a failure; the provider detects the
missed ping independently.
