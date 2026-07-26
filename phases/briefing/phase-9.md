# Phase 9 Briefing: Hardening + Release

Status: Blocked as of 2026-07-26. Tracked implementation and local automated verification are
complete; production and real-device exit criteria are not.

## Implemented

- Deterministic, user-scoped Supabase seed; Playwright critical paths; local and preview CI
  workflows; Maestro navigation/expense flows.
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
  external heartbeat. The table migration is applied remotely; the monitor schedule is intentionally
  absent until its function and explicit Vault enable flag exist.

## Automated evidence

- Schema: 42 tests; core: 198; sync: 46; tokens: 27.
- Full package/app builds, tests, ESLint, TypeScript, and repository formatting pass.
- Next.js production build passes. Sentry correctly reports that release/source-map upload is
  skipped without its auth token.
- `expo config --type public` validates. iOS and Android Metro/Hermes exports pass.
- Vercel production is READY; public Supabase and PowerSync variables exist in Development,
  Preview, and Production; no recent production runtime-error cluster was found.
- The six GitHub E2E secrets are configured without storing credentials in the checkout. The
  dedicated account `gogulaanand02+phase9e2e@gmail.com` was seeded successfully and the local
  Chromium suite passed 7/7 in 28.4 seconds on 2026-07-26. This proves 121-row pagination, month
  navigation, overspend, template dedup, expense CRUD, tax comparison, portfolio/goals fixtures,
  and the cost-free AI 400/429 paths.
- PR #4 is mergeable. CI run `30186516300` passes the complete repository gate and Playwright 7/7
  without retries after adding explicit first-sync and category-control readiness; its Vercel
  Preview deployment is READY.
- Preview E2E run `30185662946` proves the remaining preview failure is explicit and external:
  Vercel Authentication protects the URL and the project has no Automation Bypass secret mirrored
  to GitHub as `VERCEL_AUTOMATION_BYPASS_SECRET`.
- A read-only Supabase audit confirms `deadman-check` v10 is still the pre-Phase-9 implementation,
  `deadman-monitor` is absent, only `deadman-daily` is scheduled, the monitor enable flag is absent
  from Vault, and `cron_runs` has no rows.

## Required release evidence

1. Push the phase branch and prove the GitHub/Vercel Preview Playwright jobs with the configured
   secrets.
2. Configure Sentry org/project, web/native DSNs and auth token; deploy; trigger the protected
   intentional error and confirm the event and source map in Sentry.
3. Complete Auth SMTP, enable leaked-password protection, perform a clean deployed signup, and add
   `finmanager://auth/callback` to the Supabase redirect allow list; verify Google sign-in on a real
   device.
4. Explicitly approve retaining `verify_jwt=false` for `deadman-check` and `deadman-monitor`, whose
   code authenticates requests itself; deploy both. Configure `DEADMAN_MONITOR_EMAIL` and
   `DEADMAN_HEARTBEAT_URL`, set the `deadman_monitor_enabled=true` Vault flag, schedule the monitor,
   invoke a clean cron run, and prove both `cron_runs` and the heartbeat.
5. Log in to EAS, create/link the Expo project (do not invent a project ID), then build development,
   internal Android APK, and production iOS/TestFlight artifacts.
6. On a real device: prove OP-SQLite persistence across relaunch, inspect SQLCipher encryption,
   perform airplane-mode write/relaunch/reconnect, run Maestro, and record mid-range Android cold
   start/list/chart measurements.
7. Install the Android internal build and TestFlight build for family users. Delete the Phase 3
   test account only after separate explicit owner approval.

Phase 9 must remain Blocked until these external results exist. A successful JS export is not a
native build, and implemented observability code is not a deployed heartbeat.
