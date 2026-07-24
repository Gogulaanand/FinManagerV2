# Phase 8 Briefing: Inactivity Monitor (Dead-Man Switch)

Status: implementation complete; external delivery and interactive verification pending.

## What is implemented

Phase 8 adds offline-first dead-man settings and trusted-contact CRUD on web and mobile, a read-only escalation history, disclosure-scope contracts, PowerSync schema/rules, activity-log retry handling, a Vault-backed daily cron, and the `deadman-check` Supabase Edge Function. The function supports cron authentication plus authenticated `preview`, `test_send`, and `simulate` modes. Escalation is derived from activity and append-only events; a newer app-open activity row creates a cancellation event.

## Automated evidence

- `CI=true pnpm turbo run test lint typecheck`: 20/20 tasks passed.
- `CI=true node_modules/.bin/vitest run supabase/functions/deadman-check/logic.test.ts`: 3 focused backend logic tests passed.
- Tests: schema 34, sync 41, core 166.
- Web and mobile typechecks and ESLint pass.
- Repository formatting and `git diff --check` pass.

## Supabase evidence

- Migration `20260723021348_phase8_deadman` is applied to project `vkivzhbckfsjtvzatuiz`.
- `deadman-check` is active at version 3 with the custom cron-secret gateway setting.
- `deadman_settings` and `escalation_events` exist with RLS enabled.
- Vault contains the URL and cron secret used by the active `deadman-daily` job (`0 3 * * *`).
- Staged settings, contact, and activity rows exist for the authenticated web test user.
- A live cron request reached the function and recorded failed `reminder_1` events while Resend had no verified domain. After a fresh activity row, a live cron request recorded `cancelled` with `reason: app_open`.

## Delivery evidence (2026-07-24)

The staged account was repointed to the Resend account owner's address and the authenticated `simulate` sequence was run at 1, 8, 15, and 22 days against a one-day threshold. All four stages produced `sent` rows, and the Resend send log reports every one as `delivered`:

| Stage        | Sent (UTC) | Resend status |
| ------------ | ---------- | ------------- |
| `reminder_1` | 06:00:53   | delivered     |
| `reminder_2` | 06:00:54   | delivered     |
| `reminder_3` | 06:00:57   | delivered     |
| `disclosure` | 06:00:58   | delivered     |

Repeating the final stage created no second `disclosure` row and no duplicate reminders, so stage idempotency holds.

Two caveats bound this evidence. The run predates Edge Function v4 (deployed 2026-07-24 11:26 UTC), so it exercised v3. And the single trusted contact's address equals the account owner's address, so delivery to a genuinely distinct third party is still unproven.

Domain `finmanager.sunfabb.com` is verified in Resend with sending enabled, `RESEND_FROM_EMAIL` points at `deadman@finmanager.sunfabb.com`, and the PowerSync sync rules including `deadman_settings` and `escalation_events` are deployed.

## Pending exit evidence

The plan exit criteria are not yet fully met. The escalation chain has not been replayed against v4; Auth SMTP and a real signup email are not configured or proven; disclosure to a distinct third-party address is unproven; and Chrome plus native mobile interactive verification remain outstanding. Do not mark Phase 8 Done until those checks are complete.

Replaying the chain requires clearing or re-dating the staged escalation events first - see D-056 for why leftover rows correctly suppress a replay.
