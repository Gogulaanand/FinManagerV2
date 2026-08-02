# Phase 9 Release Checklist

This is an evidence checklist, not a declaration that release is complete. The canonical release
gate and risk register is [docs/PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Record links,
build IDs, device/OS versions, timestamps, and screenshots in `phases/briefing/phase-9.md`.

## Operator audit — 2026-08-01

- The current Vercel production deployment at commit `38f3f633896632a94a930d8d50fb36124c790a0f`
  is READY. The canonical site and sign-in route load in the owner’s existing Brave session;
  authenticated sign-in and data sync are not proven.
- Supabase Auth now has the canonical production URL, the scoped Vercel preview pattern, the
  local development URL, and `finmanager://auth/callback`; the saved configuration was reread in
  the dashboard after saving.
- Auth SMTP is enabled with the verified `finmanager.sunfabb.com` sender domain. A clean signup
  email and confirmation flow still require an owner-controlled test account and are not claimed.
- The Sentry `javascript-nextjs` project and an active client key exist. The Vercel variable editor
  contains the existing non-secret DSN/org/project values for all build environments; auth/test
  tokens, source-map upload, and intentional event evidence remain absent. The redeploy of the
  current merged production commit is READY.
- A real Expo project was created in the authenticated `rgogs-team` account and its exact project
  ID is linked in `apps/mobile/app.json`. Existing Supabase/PowerSync and Sentry runtime values are
  saved across development, preview, and production; `SENTRY_AUTH_TOKEN` is not configured.
- EAS CLI authentication remains open, but the Expo GitHub app is connected and Android internal
  development build `466fd4fc` finished successfully from commit `1c2cdc7`; its APK is available for
  device installation. Device checks, distribution, dead-man custom-auth approval, monitor
  schedule/heartbeat, Sentry proof, and paid-AI verification remain open. Healthchecks has no
  authenticated account in the current browser session.

## Web and CI

- [x] GitHub secrets exist: `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POWERSYNC_URL`,
      `SUPABASE_SECRET_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, and
      `VERCEL_AUTOMATION_BYPASS_SECRET`.
- [x] Local Playwright suite passes after `e2e:seed` (7/7 on 2026-07-26).
- [x] The integrated post-rebase suite collects 12 tests across three files.
- [ ] Run the integrated 12-test suite against its seeded deployment; the local shell intentionally
      has no E2E credentials.
- [x] PR CI run `30186516300` passes the repository gate and Playwright 7/7 without retries.
- [x] Vercel Preview deployment for `f58445d` is READY.
- [x] Historical Preview E2E run `30188066854` passes with the Automation Bypass secret on
      pre-rebase commit `b020d01`.
- [ ] Fresh post-rebase GitHub CI and Vercel Preview E2E pass on the current PR head.
- [x] Current production deployment at commit `38f3f633896632a94a930d8d50fb36124c790a0f` is
      READY.
- [x] The current production deployment for the merged implementation is READY.
- [ ] Authenticated production sign-in and data sync complete on the deployed site, with a saved
      account-scoped row ID and matching web readback as evidence.
- [x] Supabase Auth leaked-password protection was reviewed and explicitly waived on 2026-07-26
      because it requires a paid Supabase plan; it is not a Phase 9 release gate.
- [ ] Clean-browser signup email is received and confirmation completes without SQL.

## Sentry

- [x] Live Vercel environment audit confirms the existing non-secret Sentry DSN/org/project values
      are configured across Production, Preview, and Development.
- [x] Web environments contain the existing non-secret `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`,
      `SENTRY_ORG`, and `SENTRY_PROJECT` values.
- [ ] Web environments contain approved `SENTRY_AUTH_TOKEN` and `SENTRY_TEST_TOKEN` values, and
      the build records a successful source-map upload.
- [x] EAS environments contain the existing `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, and
      `SENTRY_PROJECT` values.
- [ ] EAS environments contain an approved `SENTRY_AUTH_TOKEN` and a native symbolicated event is
      visible in the Sentry project.
- [ ] Protected web monitoring route produces one symbolicated client/server event.
- [ ] Native development build produces one symbolicated event.

## Supabase dead-man observability

- [x] `cron_runs` table exists remotely.
- [x] `cron_runs` intentionally has RLS with no client policy; only the service role can access
      operational health rows.
- [x] Remote audit confirms `deadman-check` v11 and `deadman-monitor` v1 are ACTIVE with
      `verify_jwt=false`; only `deadman-daily` is scheduled.
- [ ] Explicitly approve retaining the deployed functions' in-code authentication with platform
      `verify_jwt=false`.
- [ ] Edge Function secrets contain `CRON_SECRET`, `RESEND_API_KEY`,
      `RESEND_FROM_EMAIL`, `DEADMAN_MONITOR_EMAIL`, and `DEADMAN_HEARTBEAT_URL`.
- [x] Vault contains `deadman_supabase_url` and `deadman_cron_secret`.
- [ ] Vault contains the explicit `deadman_monitor_enabled=true` flag before scheduling the
      monitor.
- [x] The latest daily invocation at `2026-07-29T03:00:04.225557+00:00` wrote `failed=0`.
- [ ] A clean daily invocation reaches the external heartbeat.
- [ ] A controlled failed invocation causes the independent owner alert.
- [ ] A missed heartbeat test alerts after the configured grace period.

## Native build and distribution

- [x] Local iOS and Android Metro/Hermes exports pass (3,112/15 MB and 3,193/16 MB respectively);
      these are not native builds.
- [x] `extra.eas.projectId` is linked to the real Expo project in `apps/mobile/app.json`.
- [ ] EAS account is authenticated for any CLI-driven build or release operation.
      Current CLI evidence: `Not logged in`.
- [x] GitHub-triggered Android internal development build `466fd4fc` finished successfully from
      commit `1c2cdc7`; an APK artifact is available in Expo.
- [ ] Development build installed on an Android test device.
- [ ] `native-offline-relaunch.yaml` passes and its expense later appears on web.
- [ ] SQLCipher confirmed by inspecting the database header/file while the app is stopped.
- [ ] Google OAuth returns through `finmanager://auth/callback`; password fallback still works.
- [ ] Mid-range Android cold-start, 120-row scroll, and chart-render measurements recorded.
- [ ] Preview Android APK installed by intended family users.
- [ ] Production iOS build installed through a TestFlight internal group.

## Data portability and cleanup

- [x] JSON export parses through `parseDataExportBundle` in the round-trip test.
- [ ] Web downloads and native share sheets manually opened on target devices.
- [ ] One exported JSON bundle restores into a clean test account/project with equivalent row counts,
      financial totals, dependency-order results, and a saved restore report.
- [x] R2.3 backup-policy workflows define a daily encrypted logical dump, 35-day external artifact
      retention, explicit RPO/RTO targets, and a monthly disposable-project rehearsal.
- [ ] Configure `SUPABASE_DB_URL`, `SUPABASE_BACKUP_PASSPHRASE`, and
      `DISPOSABLE_SUPABASE_DB_URL`; retain one successful backup run and one successful rehearsal
      run with measured recovery duration.
- [x] Strict template rejects malformed rows in core tests and the live Playwright second import
      created zero rows.
- [ ] Phase 3 test account deletion has separate explicit owner approval before execution.

## Cost-gated AI verification

- [x] Invalid AI scope returns 400 before a provider request.
- [x] Exhausted allowance returns 429 before a provider request.
- [ ] With owner approval for one paid call, ask a grounded question for each scope, stop one stream,
      confirm token settlement in `ai_usage`, and confirm the saved monthly summary syncs offline.
