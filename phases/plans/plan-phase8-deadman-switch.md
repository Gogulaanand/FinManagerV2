# Plan: Phase 8 - Inactivity Monitor (Dead-Man Switch)

Status: planned, not started.
Priority: after the UX navigation work in plan-mobile-nav-and-month-picker.md (owner re-prioritization, 2026-07-19).
Two sub-phases, each sized to one agent session: 8a backend + email, 8b UI + live verification.
Implements the PRODUCTION_PLAN.md Phase 8 spec: trusted contacts CRUD, daily inactivity cron, staged escalation (reminders to the user, then disclosure to contacts), everything logged and cancelable by any app open.

## Cross-doc dependencies

| Dependency | Produced by | Consumed by |
| --- | --- | --- |
| Resend account + verified sending domain + Auth SMTP | Sub-phase 8a | 8b test-sends, Phase 9b signup verification (D-024), monetization onboarding |
| Real web settings page | Sub-phase 8b | Monetization "Support" surface, improvements item #8 |
| `logActivity` hardening (improvements #12) | Sub-phase 8a | Reliability of the inactivity signal itself |

## What already exists (verified in repo)

- `trusted_contacts` table (`supabase/migrations/20260717000001_full_data_model.sql` lines 81-100): name, email, phone, relationship, `notify_after_days` default 30, priority, `is_active`, RLS scoped to `user_id`, synced via PowerSync (`supabase/powersync/sync-rules.yaml`).
- `activity_log` table (same migration, lines 106-123): `occurred_at`, `kind` default `app_open`, platform, metadata jsonb, indexed on `(user_id, occurred_at desc)`, RLS, synced.
- `packages/sync/src/activity.ts` `logActivity(db, userId, kind, platform)` already fires on every app open from `apps/web/src/components/providers.tsx:89` and `apps/mobile/components/providers.tsx:67`.
- `supabase/functions/ai-insights/index.ts` as the Edge Function scaffolding pattern (Deno.env secrets, anon client for JWT verification, admin service-role client, CORS handling).

What does not exist: pg_cron anywhere, any email integration (Resend is planned per D-024 but never wired), trusted-contacts UI on either platform, and the web settings page (`apps/web/src/app/settings/page.tsx` is still a `ModulePlaceholder`).

---

## Architecture

### Concept: derived state machines cannot get stuck

The escalation stage is never stored as a mutable status column.
It is derived on every cron run from two facts the database already holds: the user's last `activity_log` row, and which `escalation_events` exist with `created_at` newer than that activity.
A stored state machine can wedge (a crash between "send" and "update status" leaves it lying); a derived one re-computes truth from the ledger every day.
The same principle powers the app's recurring transactions (D-026) and is worth internalizing: prefer append-only facts plus derivation over mutable status flags.

### New tables (one migration)

`deadman_settings` - user-editable, RLS to `user_id`, synced read-write via PowerSync so both apps edit it offline-first:

- `user_id uuid unique` (FK auth.users, cascade)
- `is_enabled boolean default false`
- `threshold_days integer default 30`
- `disclosure_note text` (user-written free text appended to disclosure emails)
- `created_at`, `updated_at` (+ the standard updated_at trigger)

`escalation_events` - server-written audit ledger, RLS SELECT-only for the owner, writes via service role only, synced read-only for the history UI:

- `id uuid`
- `user_id uuid` (FK auth.users, cascade)
- `kind text` in `reminder_1 | reminder_2 | reminder_3 | disclosure | cancelled | test`
- `status text` in `pending | sent | failed`
- `recipient text` (email address the step targeted)
- `detail jsonb` (rendered subject, scope, simulation flag)
- `created_at`, `sent_at`

Also: `alter table trusted_contacts add column disclosure_scope text not null default 'existence'` with a check constraint on `existence | summary`.
The PowerSync sync rules (`supabase/powersync/sync-rules.yaml`) and client schema (`packages/sync/src/schema.ts` + `JSON_COLUMNS` for `escalation_events.detail`) gain both tables; remember PowerSync tables are views, so repositories use UPDATE-then-INSERT (D-022), and `deadman_settings` is keyed on the unique `user_id` like `fire_settings`.

### Escalation schedule

Only `threshold_days` (T) is user-configurable; the cadence is fixed to keep the knob count low and match the plan spec:

| Days since last activity | Step | Recipient |
| --- | --- | --- |
| T (default 30) | `reminder_1` | the user |
| T + 7 (37) | `reminder_2` | the user |
| T + 14 (44) | `reminder_3` (final warning, names the contacts) | the user |
| T + 21 (51) | `disclosure` | each active trusted contact, per its `disclosure_scope` |

### Concept: idempotency via insert-pending, send, mark-sent

Each daily run, for each enabled user, the function computes days-inactive and determines the highest due step.
A step fires only if no `sent` or `pending` event of that kind exists with `created_at` newer than the last activity.
The send path is: insert the event as `pending`, call Resend, then update to `sent` (or `failed` with the error in `detail`).
A `pending` row older than 24 hours is retried on the next run.
Failure economics: a crash after insert-before-send costs at worst one duplicate email on retry; it can never silently skip a disclosure.
For a safety feature, duplicate-on-failure is the correct side to err on.

### Cancellation is implicit

Any `app_open` (or `checkin`) row newer than the reminder events resets the derivation; no client cancel API exists.
When the cron observes activity newer than un-superseded reminder/disclosure events, it writes one `cancelled` audit event so the history UI shows the episode closed.
This is exactly the plan's "cancelable by any app open", and it costs zero client code.

### Cron wiring

- Enable `pg_cron` and `pg_net` in the migration.
- `cron.schedule('deadman-daily', '0 3 * * *', ...)` posts via `net.http_post` to the new Edge Function `deadman-check` with an `x-cron-secret` header.
- `deadman-check` verifies the header against the `CRON_SECRET` Supabase secret, then runs with the service-role client across all enabled users.
- Keeping the logic in TypeScript next to `ai-insights` (rather than PL/pgSQL) keeps it testable and lets the same function serve interactive modes.

### One function, two auth modes

`supabase/functions/deadman-check/index.ts` handles:

- Cron mode: `x-cron-secret` header, iterates all enabled users.
- User mode: `Authorization: Bearer <JWT>` like `ai-insights`, scoped strictly to the caller, with body `{ action: 'preview' | 'test_send' | 'simulate', simulateInactiveDays?: number }`.
  - `preview` returns the rendered email content per contact without sending.
  - `test_send` sends the disclosure preview to the user's own email only.
  - `simulate` runs the real derivation with `simulateInactiveDays` overriding the activity clock, writing events tagged `test` in `detail`, which is how staging verification exercises the genuine code path.

### Email: Resend, built here, shared with auth

- `supabase/functions/_shared/resend.ts`: a minimal typed `sendEmail({ to, subject, html, text })` over the Resend REST API using the `RESEND_API_KEY` secret.
- In the same session, point Supabase Auth SMTP at Resend so signup confirmation emails deliver, resolving D-024 once instead of twice (Phase 9b then only verifies it end-to-end).
- Owner prerequisite to flag early: Resend needs a verified sending domain; buy or configure one before 8a, or use Resend's test domain for staging only.

### Disclosure content

Generated server-side at send time by the service role reading Postgres.
The offline-first rule governs UI reads on devices; the server sending an email is not a UI read, and Postgres already holds the synced truth.

- `existence` scope: a template naming the user, stating that financial records exist in FinManager and how the contact should proceed; no numbers at all.
- `summary` scope: coarse per-asset-class totals only (latest holding values by type plus account balances, reusing the same aggregation shape as `packages/core` portfolio analytics); explicitly never transactions.
- Both append the user's `disclosure_note` verbatim.
- Reminder emails to the user state the day count, what happens next and when, and that opening the app cancels everything.

### logActivity hardening (improvements #12, pulled into 8a)

`logActivity` failures are currently swallowed (`void logActivity(...).catch(() => {})` in both providers).
A missed write here ages the inactivity clock and can fire a false alarm to family, which inverts normal telemetry economics: the write failing IS the incident.
Change: on failure, `console.warn` and set a module-level retry flag that re-attempts on the next foreground/app-state change; keep the app boot non-blocking.

---

## Sub-phase 8a: backend + email (1 session)

Scope:

- Migration `supabase/migrations/<ts>_phase8_deadman.sql`: two tables, `trusted_contacts.disclosure_scope`, RLS, grants, pg_cron + pg_net enablement, cron schedule.
- Sync plumbing: `supabase/powersync/sync-rules.yaml`, `packages/sync/src/schema.ts` (+ tests), new `packages/sync/src/deadman.ts` repository (settings UPDATE-then-INSERT keyed on user_id, contacts CRUD, events read), zod contracts in `packages/schema/src/deadman.ts` (+ tests).
- `supabase/functions/_shared/resend.ts` and `supabase/functions/deadman-check/index.ts` (both modes), mirroring the `ai-insights` scaffolding.
- Secrets: `RESEND_API_KEY`, `CRON_SECRET`; Supabase Auth SMTP switched to Resend.
- `logActivity` hardening in `packages/sync/src/activity.ts` + both providers.
- Verification: deploy to the linked project (`vkivzhbckfsjtvzatuiz`), then drive `simulate` with `simulateInactiveDays` = T, T+7, T+14, T+21 and confirm the reminder_1 -> reminder_2 -> reminder_3 -> disclosure sequence, that re-running the same day sends nothing (idempotency), and that a fresh app open produces the `cancelled` event.
  Also complete one real signup to prove Auth email delivery.

Exit criteria: simulation transcript (event rows + received emails) recorded in the briefing; auth signup email delivers; repo green.

## Sub-phase 8b: UI + live verification (1 session)

Scope, both platforms:

- Trusted contacts CRUD: name, email, relationship, `disclosure_scope`, priority, active toggle.
- Dead-man settings section: enable switch, threshold days, disclosure note editor.
- Preview: renders exactly what each contact would receive, from the `preview` action.
- Test-send button (to self) and an escalation history list from `escalation_events`.
- Web: replace the `ModulePlaceholder` at `apps/web/src/app/settings/page.tsx` with a real settings page (account section at parity with mobile's `apps/mobile/app/(tabs)/settings.tsx`, plus the dead-man section); this retires improvements item #8.
- Mobile: add the dead-man section to `apps/mobile/app/(tabs)/settings.tsx`; follow the modal-route pattern from plan-mobile-nav-and-month-picker.md for the contact add/edit form if that plan has landed.
- Live staged run: set the owner account's `threshold_days` temporarily to 0-1 in staging, let the real cron fire each stage, confirm receipt, then confirm a real app open cancels; restore the threshold.

Exit criteria: PRODUCTION_PLAN.md Phase 8 exit criteria met end to end (full escalation chain observed and cancelable); both-platform UI verified; briefing `phases/briefing/phase-8.md` written.

---

## Risks and mitigations

- False positives are the top product risk: mitigated by the three user-facing reminders before any disclosure, the implicit cancel on any app open, and email-delivery retries.
- Resend deliverability (spam foldering) could silently mute reminders: use a verified domain, and the `failed` status plus 24h retry make delivery failures visible in the history UI.
- Users with sync disabled or abandoned devices still write `activity_log` locally without upload; the clock uses server-side rows only, which is correct (an unreachable device is indistinguishable from inactivity) but should be stated in the settings UI copy.
- pg_cron runs in UTC; 03:00 UTC is chosen so the daily check lands in the Indian morning (08:30 IST).
