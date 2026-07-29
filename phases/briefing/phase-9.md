# Phase 9 Briefing: Hardening + Release

Status: Blocked as of 2026-07-29. Phase 9 is rebased onto merged Phase 8.5 (`93c255b`), and the
integrated implementation and local automated verification are complete. Fresh post-rebase
GitHub/Vercel evidence, production integrations, and real-device exit criteria are not.

## Implemented

- Deterministic, user-scoped Supabase seed; Playwright critical paths; local and preview CI
  workflows; Maestro navigation/expense flows.
- The integrated seed preserves Phase 8.5 dashboard/design fixtures while keeping exactly 120
  current-month transactions: 117 scale rows plus the design, legacy-category, and salary rows.
- Versioned JSON backup covering all synced collections, module CSV exports, spreadsheet-formula
  neutralization, parsers, and round-trip tests. Web downloads and native share sheet are wired.
- Strict `date,category,amount,type` expense template with Zod validation, row-numbered errors,
  case-insensitive category matching, missing-category creation, and existing import-hash dedup on
  web and mobile.
- Web and React Native Sentry initialization, source-map build wiring, guarded web monitoring route.
- EAS development/preview/production profiles and versioned native identifiers.
- Expo Go SQL.js fallback plus OP-SQLite/SQLCipher for custom builds, with a device-only random key
  in SecureStore. Mobile Google OAuth uses the Supabase redirect flow and keeps password fallback.
- `cron_runs` durable outcome migration, independent `deadman-monitor`, and optional clean-run
  external heartbeat. The table migration and both functions are deployed remotely; the monitor
  schedule is intentionally absent until explicit owner approval and its Vault enable flag exist.

## Automated evidence

- Schema: 42 tests; core: 205; sync: 49; tokens: 27 (323 total).
- `CI=true pnpm turbo run build test lint typecheck` passes all 21 tasks after the rebase.
  Repository formatting and `git diff --check` pass.
- Next.js production build passes. Sentry correctly reports that release/source-map upload is
  skipped without its auth token.
- iOS Metro/Hermes export passes with 3,112 modules and a 15 MB bundle. Android passes with 3,193
  modules and a 16 MB bundle. These are JavaScript exports, not native builds.
- Playwright collects 12 integrated tests across three files. The local shell intentionally has no
  E2E credentials, so the deployed suite must run in GitHub after the rebased branch is pushed.
- Seven GitHub E2E secrets are configured, including `VERCEL_AUTOMATION_BYPASS_SECRET` (last updated
  2026-07-26), without storing their values in the checkout. Historical Preview E2E run
  `30188066854` passed on pre-rebase commit `b020d01`; fresh integrated proof is still required.
- Vercel production deployment `dpl_9vkdpiaMxLPBx3QoYRG4MuxbNVP3` is READY at commit `93c255b`.
  Public Supabase and PowerSync variables exist in Development, Preview, and Production. No Sentry
  variables are configured in the audited Vercel project.
- Supabase migration `20260726015958` is applied. `ai-insights` v8, `deadman-check` v11, and
  `deadman-monitor` v1 are ACTIVE with `verify_jwt=false`; this observed state is not a substitute
  for the required owner approval. Only `deadman-daily` is scheduled. Its latest run at
  `2026-07-29T03:00:04.225557+00:00` wrote `failed=0`, but no external heartbeat or monitor schedule
  is configured.
- EAS CLI reports `Not logged in`; no EAS build or real-device evidence exists.

## Required release evidence

1. Push the rebased phase branch and prove fresh GitHub CI and Vercel Preview jobs with all 12
   Playwright tests.
2. Configure Sentry org/project, web/native DSNs and auth token; deploy; trigger the protected
   intentional error and confirm the event and source map in Sentry.
3. Complete Auth SMTP, perform a clean deployed signup, and add `finmanager://auth/callback` to the
   Supabase redirect allow list; verify Google sign-in on a real device. Leaked-password protection
   was explicitly waived on 2026-07-26 because it requires a paid Supabase plan.
4. Explicitly approve retaining the already-deployed `verify_jwt=false` configuration for
   `deadman-check` and `deadman-monitor`, whose code authenticates requests itself. Configure
   `DEADMAN_MONITOR_EMAIL` and `DEADMAN_HEARTBEAT_URL`, set the
   `deadman_monitor_enabled=true` Vault flag, schedule the monitor, and prove both a clean
   `cron_runs` record and the external heartbeat.
5. Log in to EAS, create/link the Expo project (do not invent a project ID), then build development,
   internal Android APK, and production iOS/TestFlight artifacts.
6. On a real device: prove OP-SQLite persistence across relaunch, inspect SQLCipher encryption,
   perform airplane-mode write/relaunch/reconnect, run Maestro, and record mid-range Android cold
   start/list/chart measurements.
7. Install the Android internal build and TestFlight build for family users. Delete the Phase 3
   test account only after separate explicit owner approval.

Phase 9 must remain Blocked until these external results exist. A successful JS export is not a
native build, a clean cron row is not an external heartbeat, and deployed functions do not imply
approval of their authentication posture.
