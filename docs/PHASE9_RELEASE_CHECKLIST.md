# Phase 9 Release Checklist

This is an evidence checklist, not a declaration that release is complete. Record links, build IDs,
device/OS versions, timestamps, and screenshots in `phases/briefing/phase-9.md`.

## Web and CI

- [x] GitHub secrets exist: `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POWERSYNC_URL`,
      `SUPABASE_SECRET_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.
- [x] Local Playwright suite passes after `e2e:seed` (7/7 on 2026-07-26).
- [x] PR CI run `30186516300` passes the repository gate and Playwright 7/7 without retries.
- [x] Vercel Preview deployment for `f58445d` is READY.
- [ ] Generate a Vercel Automation Bypass secret and copy it to GitHub as
      `VERCEL_AUTOMATION_BYPASS_SECRET`; run `30185662946` proves the workflow fails fast with this
      exact missing-secret diagnostic.
- [ ] Vercel Preview deployment triggers `Preview E2E` and passes.
- [ ] Production deployment is READY and sign-in/data sync work.
- [ ] Supabase Auth leaked-password protection is enabled.
- [ ] Clean-browser signup email is received and confirmation completes without SQL.

## Sentry

- [ ] Web environments contain `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`,
      `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, and
      `SENTRY_TEST_TOKEN`.
- [ ] EAS environments contain `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
      `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`.
- [ ] Protected web monitoring route produces one symbolicated client/server event.
- [ ] Native development build produces one symbolicated event.

## Supabase dead-man observability

- [x] `cron_runs` table exists remotely.
- [x] `cron_runs` intentionally has RLS with no client policy; only the service role can access
      operational health rows.
- [x] Remote audit confirms the current `deadman-check` v10 predates Phase 9,
      `deadman-monitor` is absent, only `deadman-daily` is scheduled, and `cron_runs` is empty.
- [ ] Deploy `deadman-check` and `deadman-monitor` with their in-code authentication and
      platform `verify_jwt=false` explicitly approved.
- [ ] Edge Function secrets contain `CRON_SECRET`, `RESEND_API_KEY`,
      `RESEND_FROM_EMAIL`, `DEADMAN_MONITOR_EMAIL`, and `DEADMAN_HEARTBEAT_URL`.
- [ ] Vault contains `deadman_supabase_url`, `deadman_cron_secret`, and the explicit
      `deadman_monitor_enabled=true` flag before scheduling the monitor.
- [ ] A clean daily invocation writes `failed=0` and reaches the external heartbeat.
- [ ] A controlled failed invocation causes the independent owner alert.
- [ ] A missed heartbeat test alerts after the configured grace period.

## Native build and distribution

- [ ] EAS account is authenticated and `extra.eas.projectId` comes from the linked project.
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
- [x] Strict template rejects malformed rows in core tests and the live Playwright second import
      created zero rows.
- [ ] Phase 3 test account deletion has separate explicit owner approval before execution.

## Cost-gated AI verification

- [x] Invalid AI scope returns 400 before a provider request.
- [x] Exhausted allowance returns 429 before a provider request.
- [ ] With owner approval for one paid call, ask a grounded question for each scope, stop one stream,
      confirm token settlement in `ai_usage`, and confirm the saved monthly summary syncs offline.
