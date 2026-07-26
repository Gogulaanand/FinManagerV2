# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

## Latest Handoff: 2026-07-26 (Phase 9 implementation complete; release gates blocked)

### Where we are

Phase 9's tracked implementation is committed and pushed on `phase-9-hardening-release` in draft
PR #4, based on current `origin/main` and headed by `08f5c87`.
It includes the deterministic web/mobile E2E harnesses, preview-deployment workflow, versioned
JSON/module-CSV export, strict expense template import on both clients, web/native Sentry wiring,
EAS profiles, mobile Google OAuth, SQLCipher-backed OP-SQLite outside Expo Go, and durable
dead-man cron outcomes plus an independent monitor and optional external heartbeat.

Migration `phase9_cron_observability` is applied to Supabase `vkivzhbckfsjtvzatuiz`; the production
Edge Function updates are not deployed because they require retaining `verify_jwt=false` for the
functions' custom `x-cron-secret`/in-body auth, and the deployment guard requires explicit approval.
The new `deadman-monitor-daily` schedule was removed after that deployment was blocked, so it cannot
call a missing function. Recreate it only after deployment by setting the explicit
`deadman_monitor_enabled=true` Vault flag and applying/scheduling the documented job.

### Verification state

The repository package tests pass (schema 42, core 198, sync 46, tokens 27), app/package typechecks
and ESLint pass, formatting is clean, the Next.js production build passes, and Expo bundles both
iOS and Android. Expo public config validates. The linked Vercel deployment is READY and all three
public environment variables exist across its environments.

The six Supabase/E2E GitHub secrets are configured through secure pipes. The dedicated account
`gogulaanand02+phase9e2e@gmail.com` seeds successfully and the local Chromium suite passes 7/7 in
28.4 seconds, including the cost-free AI 400/429 paths. PR CI run `30185240533` passes both the full
repository gate and Playwright. The latest Vercel Preview is READY, but direct access redirects to
Vercel SSO; Preview E2E therefore requires a project Automation Bypass secret copied to GitHub as
`VERCEL_AUTOMATION_BYPASS_SECRET`. EAS still reports `Not logged in`. Sentry org/project/DSN/auth
token are absent. There is no connected native device, so
encrypted-at-rest inspection, offline relaunch/reconnect, Google login, Maestro, Android
performance numbers, and family installs are not claimed.

### Exact next action

Generate a Vercel Automation Bypass secret for `fin-manager-web` and copy it to the repository
secret `VERCEL_AUTOMATION_BYPASS_SECRET`, then rerun Preview E2E. Next provide Expo and Sentry
account access and explicitly approve retaining custom-auth `verify_jwt=false` when deploying
`deadman-check` and `deadman-monitor`. Follow the ordered checklist in
`phases/briefing/phase-9.md`. The Phase 3 test-account deletion still requires the plan's separate
explicit owner approval.

### Files in flight

All Phase 9 source, workflow, migration, function, manifest/lockfile, and closeout-doc changes are
committed and pushed in draft PR #4.

### Open items / warnings

- Do not put the Supabase secret key or E2E password in tracked files. The fixture accepts the new
  `SUPABASE_SECRET_KEY` first and the legacy service-role variable only as a migration fallback.
- Do not use Expo Go to claim persistence or SQLCipher; it intentionally stays on SQL.js.
- A lost SecureStore database key requires clearing app data/reinstalling and re-syncing.
- Do not enable platform JWT verification on custom-auth cron functions without also changing the
  scheduled request authentication; doing so would make every cron invocation fail at the gateway.

---

## Latest Handoff: 2026-07-25 (Phase 8 raised as a PR)

### Where we are

Phase 8 is committed on `phase-8-inactivity-monitor` and raised as a PR against `main`, which the owner explicitly authorised.
The Resend domain `finmanager.sunfabb.com` is verified, `RESEND_FROM_EMAIL` is `deadman@finmanager.sunfabb.com`, and the PowerSync sync rules carrying `deadman_settings` and `escalation_events` are deployed.
All four escalation stages were delivered end to end on 2026-07-24 and the repeated final stage produced no duplicates, but that run predates Edge Function v4 so it has not been replayed against the deployed code.

This session also fixed a real defect rather than only verifying: activity was recorded once per mounted session, so a backgrounded mobile app or a long-lived browser tab stopped proving liveness and would have escalated to trusted-contact disclosure against an active user. See D-055.

### Verification state

`CI=true pnpm turbo run build test lint typecheck` passes 21/21; Prettier is clean on every changed file. `packages/sync/src/activity.test.ts` covers the new freshness path with 5 tests. Resend reports all four stage emails as `delivered`, not merely accepted.

### Exact next action

Replay the escalation chain against v4 using `PHASE8_EXTERNAL_VERIFICATION_RUNBOOK.md`.
The staged escalation events must be cleared or re-dated first, otherwise the replay is correctly suppressed and reports `{"events":[]}` - see D-056.
Then configure Auth SMTP, prove one real signup email, add a trusted contact at an address distinct from the account owner's, and run the Chrome and native mobile passes.

### Open items / warnings

- The staged account `f2014cd9-7e2b-46aa-9555-a701c7aad0a5` is now `gogulaanand281@gmail.com`, not the `+webtest` alias several older notes still name.
- Its single trusted contact uses that same address, so third-party disclosure is unproven.
- During this session the staged `activity_log` was temporarily backdated to drive a replay and then restored exactly to `2026-07-23 02:27:13.778779+00` with all 90 rows intact. Any future backdating must be undone before the `deadman-daily` job runs at 03:00 UTC.
- Verify whether v4 still writes a `cancelled` row on every cron call. Under v3 five consecutive calls each wrote one despite no app open; the v4 guard looks correct on inspection but has not been observed running.

---

## Previous Handoff: 2026-07-23 (Phase 8 dead-man switch)

### Where we are

Phase 8 local implementation is present but intentionally uncommitted pending owner approval. It adds the dead-man settings and escalation-event migration, PowerSync schema/rules, Zod contracts and repositories, Resend/`deadman-check` Edge Function scaffolding with cron/user modes, staged delivery/cancellation logic, activity-log retry on web visibility/mobile foreground, and trusted-contact/dead-man settings UI on both platforms. The 2026-07-23 audit remediation also fixed the web preview newline rendering, extracted and tested the Edge Function’s pure stage/idempotency logic, and clarified D-042/D-052 and the Vault cron prerequisite in D-054.

### Verification state

Schema tests (34), sync tests (41), the focused Edge Function logic tests (3), schema/sync/web/mobile typechecks, web/mobile ESLint, and the repository Prettier check pass. The authenticated web fixture is saved with the monitor enabled at a one-day threshold and one active existence-scope contact. The linked project now has the Phase 8 tables, `deadman-check` version 3 (`verify_jwt=false`), Vault-backed cron secrets, and an active `deadman-daily` job. A live cron-triggered `reminder_1` attempt reached the function and created a failed event; Resend rejected the test recipient because no verified domain exists. A subsequent fresh activity row produced a live `cancelled` event with `reason: app_open`. PowerSync rule deployment, successful Resend delivery, Auth SMTP, and the full simulation transcript remain pending.

### External prerequisites / exact next action

- A dedicated Resend sending-only key is configured in the linked project as `RESEND_API_KEY`; `RESEND_FROM_EMAIL` is currently the Resend staging sender `onboarding@resend.dev` because no verified domain exists. Resend currently reports no domains and no received emails. Resend's staging sender can deliver only to the Resend account owner, while the seeded Supabase test user has a different email. Verify a domain or switch to a test account matching the Resend owner before claiming delivery. Point Supabase Auth SMTP at Resend before claiming signup delivery.
- `CRON_SECRET` is configured in the linked project. The hosted deployment stores `deadman_supabase_url` and `deadman_cron_secret` in Supabase Vault; the active `deadman-daily` job runs at `0 3 * * *` and reads both secrets at execution time.
- Migration `supabase/migrations/20260723021348_phase8_deadman.sql` is applied remotely and `deadman-check` is deployed with its custom-auth gateway setting. The current workspace has no PowerSync deployment CLI or connector, so publish `supabase/powersync/sync-rules.yaml` from the PowerSync dashboard before running the authenticated `simulate` sequence at T, T+7, T+14, and T+21; repeat one stage for idempotency and open the app for `cancelled`. The cron cancellation behavior is already proven; the staged event ledger contains failed reminder attempts plus the cancellation event, not a successful escalation chain.
- Complete one real signup email and record received email/event rows in `phases/briefing/phase-8.md`.

Do not commit until the owner reviews this diff and approves it. Do not claim Phase 8 complete until the external exit criteria are evidenced.

---

## Latest Handoff: 2026-07-21 (Repo-wide improvements)

### Where we are

`phases/plans/plan-improvements.md` I1, I2, and I3 are implemented. AI usage now reserves the estimated request budget through the atomic `record_ai_usage` RPC and settles actual usage afterward; both Insights clients have a 60-second idle timeout and visible Stop controls. Goals, Portfolio, and Expenses wait for the first PowerSync sync before mounting query hooks on web and mobile. Savings, percentage, SWR, and budget math is shared through `@finmanager/core`; scenario update/insert writes run inside `writeTransaction`. The largest expense, portfolio, tax, and goals sections are extracted into focused components, and the five plan documents are indexed from `STATUS.md`.

### Verification state

Core tests (166) and sync tests (37) pass; schema/core/sync/tokens builds, package and app TypeScript checks, package/app ESLint, changed-file Prettier checks, and the web production build all pass. The pgTAP file is at `supabase/tests/database/ai_usage.test.sql`; both `supabase test db --local` and `supabase test db --linked` pass all 4 tests. Supabase MCP also verified 8 concurrent reservations aggregate to `80/160/8`, then release atomically back to `0/0/0`; the isolated test row was deleted. No commit has been made.

### Open items

- Review the final diff and confirm the direct verification results above.
- Owner approval is required before committing.

## Previous Handoff: 2026-07-21 (Mobile navigation and month-picker plan)

### Where we are

The plan in `phases/plans/plan-mobile-nav-and-month-picker.md` is implemented and remains uncommitted for owner approval. Mobile transaction, goal, holding, and budget forms are stack routes with native back behavior; success notices use the shared mobile notice store. Both platforms have bounded month/year pickers backed by shared core month helpers. The exact escalated `CI=true pnpm turbo run build test lint typecheck` gate passes 21/21, and `CI=true pnpm format:check` passes. Local Chrome verified the web picker, bounds, January 2024 jump, trend re-anchoring, reset, Escape close, and no console errors.

### Exact next action

Review the uncommitted diff and approve the commit. Before phase closure, run the plan’s iOS/Android route, edge-swipe/hardware-back, save-notice, month-picker, and offline/reconnect scenarios on an available simulator/device, then write the plan-specific briefing entry.

### Files in flight

The source and test files shown by `git status --short`, including the six mobile routes, mobile budget form, notice store, both month-picker components, core month helpers/test, platform expense hook changes, web ESLint compatibility adjustment, deterministic quote-test clock. No generated build output is intended to be committed.

### Open items / warnings

- CoreSimulatorService is unavailable in this environment; `adb` is not installed, so native interactive evidence is not claimed.
- Expo web export bundles the app but static rendering reaches a native bridge error; use Expo Go/simulator for the intended mobile verification.
- The quote test’s injected clock is a deterministic test-only fix for a stale fixture; no quote production behavior changed.
- Do not commit until the owner reviews and approves the full diff.

---

## Latest Handoff: 2026-07-19 (Phase 5.3 + Phase 7 closed; Vercel wired up)

### Where we are

Phases 5.3 (UX simplification) and 7 (AI Insights) are fully tested and committed.
All automated tests pass (`CI=true pnpm turbo run build test lint typecheck` green, 21/21 tasks).
Phase 7 backend is live on Supabase `vkivzhbckfsjtvzatuiz`: migration `20260719000004` applied, `ai-insights` Edge Function active (v1, verify_jwt=true), `ANTHROPIC_API_KEY` set in Supabase secrets, PowerSync `ai_summaries` rule published.
The GitHub repo is linked to Vercel (`fin-manager-web`) and the build passes - but the app does not load because the three `NEXT_PUBLIC_*` env vars have not been configured in Vercel yet.

### Exact next action

**Fix Vercel deployment - two steps:**

1. In the Vercel project dashboard > Settings > Environment Variables, add all three variables (all environments):

   | Variable                        | Value                                                        |
   | ------------------------------- | ------------------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://vkivzhbckfsjtvzatuiz.supabase.co`                   |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_nwtm1eYDVnXoYzFUbhZJwg_oyEe-jUc`             |
   | `NEXT_PUBLIC_POWERSYNC_URL`     | `https://6a5b0b247f33bac37ef7cefc.powersync.journeyapps.com` |

2. In Supabase dashboard > Authentication > URL Configuration, add the Vercel production URL (e.g. `https://fin-manager-web.vercel.app`) to **Redirect URLs** so OAuth / magic-link auth works from the deployed app.

3. Also check Vercel's **Root Directory** setting: it must be set to `apps/web` (or the Build Command must be `cd apps/web && pnpm build` with Output Directory `apps/web/.next`), since this is a pnpm monorepo and Next.js lives in `apps/web`. The `postinstall` script (`powersync-web copy-assets -o public`) must also run - if using root directory `apps/web`, set Install Command to `cd ../.. && pnpm install`.

   Recommended Vercel settings:
   - **Root Directory**: `apps/web`
   - **Install Command**: `cd ../.. && pnpm install`
   - **Build Command**: `pnpm build` (runs `next build`)
   - **Output Directory**: `.next`

After the app loads, verify sign-in and PowerSync sync work on the Vercel URL before starting Phase 8.

### Files in flight

No source files are in flight - repo is clean and green.
The only outstanding setup is Vercel env vars + Supabase redirect URL (external configuration, not tracked files).

### Open items / warnings

- `ANTHROPIC_API_KEY` lives only in Supabase secrets (server-side). Do NOT add it to Vercel env vars.
- `ai_usage` is server-written and unsynced; only `ai_summaries` is in PowerSync.
- The other Supabase project `cqgdpoinootjkshdevpu` is NOT the target; all Phase 4-7 migrations are on `vkivzhbckfsjtvzatuiz`.
- Expo Go still uses SQL.js in-memory adapter; relaunch persistence is deferred to Phase 9 (D-021).
- Next up after Vercel fix: correctness sweep (phases/plans/plan-improvements.md), then mobile nav/month-picker UX, then Phase 8 dead-man switch.

---

## Latest Handoff: 2026-07-19 (Phase 7, session 1)

### Where we are

Phase 7 implementation is code-complete on `phase-7-ai-insights` after fast-forwarding to current `main` (`9e447b5`, Phase 5.3). It adds the private metering/synced-summary migration, authenticated Anthropic SSE Edge Function, shared schema/digest/SSE parser and tests, PowerSync summary repository, matching web/mobile Insights workspaces, offline monthly health cards, and the five-slot mobile tab bar with a More sheet. The full automated gate and Expo iOS export pass. No Chrome or real Expo Go result is claimed, and the migration/function/secret/PowerSync rule have not been deployed from this worktree.

### Exact next action

Follow `Pending deployment` and the numbered Chrome scenarios in `phases/phase-7-ai-insights-plan.md`. Start by applying migration `20260719000004_phase7_ai_insights.sql`, setting `ANTHROPIC_API_KEY`, deploying `ai-insights`, and deploying the PowerSync rule. Then verify the grounded Budget answer, scope isolation, ephemeral reload, summary upsert/offline read, 429 allowance state, auth/validation, usage accounting, and visual/accessibility states. Run the Expo Go navigation/streaming/summary checks afterward.

### Files in flight

The implementation and automated-test changes are committed with this handoff. `phases/briefing/phase-7.md` lists the subsystem/file groups. The only intentionally incomplete Phase 7 work is external deployment and interactive evidence/fixes.

### Open items / warnings

- Do not mark Phase 7 done until deployment and the plan's Chrome/Expo Go scenarios pass.
- The Supabase worktree is not locally linked. Confirm the intended project before applying migration/function changes.
- `ANTHROPIC_API_KEY` belongs only in Supabase secrets. `ai_usage` must remain server-written and unsynced; only `ai_summaries` is in PowerSync.
- Normal allowance defaults to 1,000,000 tokens/month. Restore it after deliberately testing the 429 state.
- Chat is intentionally ephemeral. A reload clearing chat is correct; monthly summaries are the only persisted AI content.
- Expo Go uses SQL.js in-memory storage. Verify offline behavior on the mounted screen and reconnect, not relaunch persistence (D-021).
- Phase 5.3, Phase 6, and older Expo Go interactive carryovers remain separate pending verification items below.

---

## Latest Handoff: 2026-07-19 (Phase 5.3, session 1)

### Where we are

Phase 5.3 implementation is complete but interactive verification is intentionally pending. Expenses now use six-month window + month page/count PowerSync queries, growing-LIMIT pagination, full-month aggregates, web Load more, and a mobile owning `FlatList` with memoized rows, collapsed uncapped Accounts/Categories, and measured responsive Victory charts. Portfolio hubs now navigate to dedicated holding detail routes on web and mobile; detail owns contextual event/value/edit forms and a merged deletable timeline. Event kinds use shared labels/asset subsets, mobile event/value entry is keypad-first, and raw special-asset metadata JSON has been replaced with typed fields on both platforms. `CI=true pnpm turbo run build test lint` passed 15/15; standalone web/mobile typecheck and lint passed.

### Exact next action

Open Chrome with the existing signed-in test account and execute the numbered Chrome scenarios under `Pending interactive verification` in `phases/phase-5.3-ux-simplification-plan.md`. Then run its Expo Go and airplane-mode/reconnect scenarios. Record screenshots, counts, timestamps, console errors, and synced row IDs. Fix any failures, rerun the full gate, write `phases/briefing/phase-5.3.md`, update STATUS/HANDOFF, and commit the verification close-out.

### Files in flight

No uncommitted implementation should remain after this handoff commit. Phase 5.3's implementation file union is visible in that commit; the missing phase-end deliverable is `phases/briefing/phase-5.3.md`, deliberately deferred until interactive verification passes.

### Open items / warnings

- Do not mark Phase 5.3 complete from automated checks alone. Chrome, Expo Go, and offline/reconnect evidence are required.
- Chrome was installed with the ChatGPT extension/native host configured, but was not running during this session; no browser claim was made.
- Expo Go SQL.js is in-memory. Test offline write/read/reconnect on the mounted screen, not relaunch persistence (D-021).
- `TRANSACTIONS_QUERY` remains exported because Phase 6 Goals still uses it for trailing expense suggestions; the Phase 5.3 expense hooks no longer use it.
- Phase 6 interactive verification also remains outstanding and should not be conflated with Phase 5.3 closure.

---

## Latest Handoff: 2026-07-18 (Phase 6, session 1)

### Where we are

Phase 6 (Goals + Retirement + FIRE) is code-complete and the whole repo is green: `CI=true pnpm turbo run build test lint typecheck` passes 21/21 and `CI=true pnpm format:check` is clean.
The goal/FIRE/retirement math is entirely in `packages/core/src/goals` with Vitest suites (core is now 140 tests). Schema (`packages/schema/src/goals.ts`) and sync repositories (`packages/sync/src/goals.ts`) are added and exported. Web and mobile both ship a full Goals & FIRE workspace replacing the placeholder.
No migration was needed: the `goals` and `fire_settings` tables (RLS + indexes) and the PowerSync client schema/`JSON_COLUMNS` were already scaffolded (see D-035).
Separately, a repo-wide `prettier --write` fixed the CI failure on `main` that came from unformatted files in the phase 5.2 merge (mobile portfolio/card/motion, web motion components, `packages/sync/src/expenses.ts`, and a motion plan doc).

### Exact next action

Run the Phase 6 interactive checklist on real Chrome and Expo Go with the signed-in test account: create an education goal with a target date, confirm the inflation-adjusted future cost, monthly SIP, funding bar, and on/off-track status; link a holding and confirm current funding folds it in; save FIRE settings and confirm the FIRE number (expenses / withdrawal rate), lean/coast/fat variants, and years-to-FIRE; add an EPF/PPF/NPS holding and confirm the retirement corpus; then do an offline goal write + reconnect + sync. After that passes, start Phase 7 (AI Insights) using `phases/briefing/phase-6.md`.

### Files in flight

All Phase 6 files are written and green but not yet committed. See `phases/briefing/phase-6.md` for the exact file list. Nothing is intentionally incomplete.

### Open items / warnings

- **Phase 6 interactive verification outstanding** (as above); the no-touch simulator and Chrome connector limits from Phase 5 still apply.
- **FIRE current corpus = portfolio net worth.** **Monthly savings** now uses the explicit `fire_settings.monthly_investment` when set, else the derived rate (average of trailing months' credit − debit, floored at zero). A user with only expenses logged and no explicit investment still sees 0 until they set a monthly investment or log income (D-037). The projection also exposes `requiredMonthlyContribution` (SIP to reach FIRE by retirement age, in today's rupees) and `contributionGap` vs the current rate; both are null until current + retirement age are set. Migration `20260718000003` adds the column and was applied to `vkivzhbckfsjtvzatuiz`.
- **FIRE annual expenses are auto-suggested** from the trailing 12 months of debit transactions only until the user saves an explicit value; the saved value then wins.
- Phase 5 carry-over below still applies (Expo Go Phase 4+5 pass, SMTP, test-account cleanup, native adapter swap).

---

## Prior Handoff: 2026-07-18 (Phase 5, session 2)

### Where we are

Chrome E2E verification of the combined Phase 4 + Phase 5 prompt is complete (steps 1-15 verified with the signed-in test account `gogulaanand02+webtest@gmail.com`).
All expected results were confirmed: HDFC Salary account (₹80,000), Verification Lunch/Grocery expenses (₹2,500 total), July Food budget overspend (₹2,500/₹2,000), CSV import dedup (0 created / 2 skipped on repeat), Reliance Industries holding with ~10% XIRR, RSU FX completeness toggle, manual override survivability after quote refresh, net worth with account balances, and offline write + PowerSync sync (both rows confirmed in Supabase with IDs and timestamps).
Three bugs were fixed and committed this session: `saveTransaction` SELECT-check-then-INSERT (D-033), `effectiveHoldingValue` manual override priority (from prior session), and `saveHoldingOn`/`saveHoldingEventOn`/`saveValuationOn` isNew branching (from prior session).
`pnpm turbo run build test lint --filter=@finmanager/sync...` is green (22/22 sync tests pass).
Expo Go uses SQL.js in-memory adapter; relaunch persistence deferred to Phase 9 (D-021).

### Exact next action

Run the mobile path of the combined Phase 4 + Phase 5 prompt on a **real Expo Go device** (iOS or Android) with the same signed-in test account.
After that passes, start **Phase 6 (Goals + Retirement + FIRE)** using `phases/briefing/phase-5.md` as the prior-phase briefing.

### Files in flight

All files are committed. No in-flight work remains.
The three fixed sources: `packages/core/src/portfolio/analytics.ts`, `packages/sync/src/expenses.ts`, `packages/sync/src/portfolio.ts`.

### Open items / warnings

- **Expo Go mobile interactive verification outstanding:** run the keypad, CRUD, budget, offline write/reconnect path on a real Expo Go device. The sql-js adapter is in-memory so do not test relaunch persistence (Phase 9 task).
- **Phase 5 migration** is at `supabase/migrations/20260718000002_phase5_portfolio.sql` and was already applied to the linked project (`vkivzhbckfsjtvzatuiz`). No re-application needed.
- **Supabase email confirmation is ON and the built-in mailer is rate-limited**, so real signups can't complete. The Phase 3 web E2E confirmed its test account via a direct `email_confirmed_at` SQL update. Fix with SMTP/Resend (the planned email provider) or a deliberate toggle at Phase 9 (D-024).
- **A Phase 3 test account with two synced scenarios remains in Supabase.** Credentials are intentionally omitted from tracked docs. Rotate or delete that account after cross-platform verification with explicit operator approval; it is test pollution otherwise.
- **Google sign-in is web-only.** Mobile needs the expo-web-browser + deep-link OAuth flow; deferred (email/password works on mobile).
- **PowerSync tables are SQLite views: no UPSERT.** Use UPDATE-then-INSERT (see `saveScenario`). Any new jsonb column must be added to `JSON_COLUMNS` in `packages/sync/src/schema.ts` or its writes fail at PostgREST (D-022).
- **Mobile uses the sql-js PowerSync adapter to stay in Expo Go (D-021), which is in-memory** - local data re-syncs from Supabase rather than persisting across relaunch. The OP-SQLite swap (native, encrypted, persistent) is a Phase 9 task and is localized to `apps/mobile/lib/powersync.ts`.
- **Phase 5 interactive verification remains outstanding:** the combined prompt below must be run in a real Chrome session and on a real Expo Go device. The no-touch simulator and unavailable Chrome connector prevented claiming this manual pass.
- **Phase 5 FX and quote rules:** non-INR events and valuations require dated `fxRateToInr`; manual value/price overrides win over automatic quotes; quote refresh is online-only and persists provenance without replacing manual fields.
- **Reusable review workflow:** `docs/workflows/sol-read-only-review-worker.toml` defines the SOL read-only reviewer, its responsibilities, and the exactly-two-review cadence used in this session.
- **Do not `pnpm add` native mobile deps or install while a dev server runs** (D-020). Web PowerSync workers are copied into `apps/web/public/@powersync/` by a `postinstall`; that dir is gitignored and regenerated.
- Dev servers (Next on some port, Metro on 8081) may still be running from this session; they are disposable.
- Money stays float rupees through `roundToPaise` (D-014); in the PowerSync client schema money is `column.real`, booleans are `column.integer`, timestamps/jsonb are `column.text`.

## Combined Phase 4 + Phase 5 Chrome verification prompt

Copy/paste the following as one verification task after the Phase 5 migration is applied in the intended linked Supabase project:

```text
Use the existing signed-in Phase 3/4 test account in Chrome and the same account in Expo Go. Do not print or rotate credentials. Record the account email alias, device/browser, commit, migration status, timestamps, and screenshots for every expected result.

Phase 4 expenses and budgeting:
1. In the web app, create or select the bank account “HDFC Salary” with current balance ₹80,000. Add a Food expense on 2026-07-18 for ₹850 with merchant “Verification Lunch”, then add a Food expense on 2026-07-19 for ₹1,650 with merchant “Verification Grocery”. Confirm both rows appear with debit signs and the expense total is ₹2,500; do not assume the manually stored account snapshot changes unless the account-balance flow explicitly changes it.
2. Set the Food monthly budget for July 2026 to ₹2,000. Confirm the progress is ₹2,500/₹2,000, the overspend state is visible, and all three Phase 4 charts render with the two expenses represented.
3. Import this exact CSV twice through the Phase 4 bank importer:
   Date,Description,Amount,Debit,Credit
   2026-07-18,"Verification Lunch",850,850,
   2026-07-19,"Verification Grocery",1650,1650,
   The first preview/commit must create two rows; the second must create zero duplicate rows and report both rows skipped by canonical import hash.

Phase 5 portfolio and investments:
4. Add a listed holding “Reliance Industries” of type stock, identifier RELIANCE.NS, quantity 10, currency INR, and average cost ₹1,000. Add a buy event dated 2025-01-01 for quantity 10, price ₹1,000, amount -₹10,000. Add a valuation dated 2026-01-01 for ₹11,000. Confirm the portfolio screen shows invested ₹10,000, current value ₹11,000, gain ₹1,000, 100% equity allocation, and a positive XIRR close to 10% (allow rounding differences).
5. Add a foreign stock “Verification RSU” with type rsu, identifier VERIFY.RSU, source currency USD, grant date 2025-01-01, grant price USD 10, vest schedule 2025-07-01 quantity 10 vested true, and current quantity 10. Add a USD vest event dated 2025-07-01 with amount 0 and a USD valuation dated 2026-01-01 for USD 150 with fxRateToInr 85. Confirm the holding is marked complete only when the dated FX is present; remove the FX and confirm missing-FX/incomplete messaging appears.
6. On Reliance, set a manual value override of ₹12,500. Press Refresh prices while online. Confirm the screen still uses ₹12,500 and the automatic quote fields show provider/source/as-of only when a quote is returned. Clear the override and confirm the displayed value falls back to the automatic/current value. If the quote provider is unavailable, confirm a visible stale/offline/failed result and no silent overwrite.
7. Confirm net worth includes the ₹80,000 bank account plus valued holdings and does not double-count an account linked to a cash holding. Confirm an unvalued holding contributes to the incomplete count rather than being silently treated as zero.

Offline and sync checks for both phases:
8. In Chrome, enable airplane mode or use the app’s PowerSync offline control. Add an expense “Offline Phase4” for ₹275 and a holding event “Offline Phase5” for Reliance dated 2026-07-18. Confirm both appear immediately from local state while offline and no direct UI data fetch is attempted.
9. Reconnect, wait for PowerSync upload/download, and confirm both rows appear in Supabase and on a second signed-in device/session. Capture the local-write time, reconnect time, sync completion time, and row IDs. Repeat the duplicate CSV import after reconnect and confirm the same canonical skip counts.
10. Because Expo Go uses the SQL.js in-memory adapter, do not claim local persistence across a mobile relaunch. Verify offline write/read/reconnect on the live screen, and report relaunch persistence as deferred to the Phase 9 native adapter swap.

Evidence to report: commit SHA; migration list and schema/constraint/index/RLS results; account identifier without credentials; exact created/skipped/failed import counts; screenshots of Phase 4 budget/charts and Phase 5 summary/allocation/XIRR/quote provenance; offline local-write and reconnect timestamps; second-device row IDs; console/network errors; and any mismatch between expected and observed amounts.
```

---

## Handoff Template (copy for each session)

```markdown
## Latest Handoff: YYYY-MM-DD (Phase N, session M)

### Where we are

One paragraph: what works, what is half-done.

### Exact next action

The first concrete thing the next session should do.

### Files in flight

Paths touched this session, and any that are intentionally incomplete.

### Open items / warnings

Gotchas, failing tests, pending background jobs, credentials needed.
```
