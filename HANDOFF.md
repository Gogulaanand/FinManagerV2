# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

---

## Latest Handoff: 2026-07-18 (Phase 3 complete)

### Where we are

Phase 3 is complete and committed in three parts (`4b5152b`, `d4d8fc5`, `cce2011`); nothing is half-done.
The app now has real auth (Supabase email+password, plus Google on web) and a working offline-first data layer (PowerSync) on both platforms, backed by the full 13-table data model with per-table RLS. Tax scenarios were migrated off localStorage/AsyncStorage onto the synced `tax_scenarios` table; the calculator still runs signed-out, and saving is gated to signed-in.
Web was verified end to end against the live backend, including the offline-write-then-sync round trip and two-user RLS isolation. Mobile bundles and boots in Expo Go with the full stack and no runtime errors, but interactive sign-in/sync could not be driven in this no-touch simulator.

### Exact next action

Start Phase 4 (Expenses + Budgeting): read `phases/briefing/phase-3.md`. The `accounts`, `categories`, `transactions`, and `budgets` tables already exist with RLS and are in `packages/sync`'s `AppSchema`, so Phase 4 is domain logic (in `packages/core`) + UI over the established `useQuery` + repository pattern (see `useScenarios`).

### Files in flight

None. The working tree is clean and committed. See `phases/briefing/phase-3.md` for the full list.

### Open items / warnings

- **Supabase email confirmation is ON and the built-in mailer is rate-limited**, so real signups can't complete. The Phase 3 web E2E confirmed its test account via a direct `email_confirmed_at` SQL update. Fix with SMTP/Resend (the planned email provider) or a deliberate toggle at Phase 9 (D-024).
- **A web test account `gogulaanand02+webtest@gmail.com` (password `Test-Passw0rd-1`) with two synced scenarios is left in Supabase.** Sign in with it on a real device/sim to watch cross-platform sync-down, then delete it from the dashboard. It is test pollution otherwise.
- **Google sign-in is web-only.** Mobile needs the expo-web-browser + deep-link OAuth flow; deferred (email/password works on mobile).
- **PowerSync tables are SQLite views: no UPSERT.** Use UPDATE-then-INSERT (see `saveScenario`). Any new jsonb column must be added to `JSON_COLUMNS` in `packages/sync/src/schema.ts` or its writes fail at PostgREST (D-022).
- **Mobile uses the sql-js PowerSync adapter to stay in Expo Go (D-021), which is in-memory** - local data re-syncs from Supabase rather than persisting across relaunch. The OP-SQLite swap (native, encrypted, persistent) is a Phase 9 task and is localized to `apps/mobile/lib/powersync.ts`.
- **Do not `pnpm add` native mobile deps or install while a dev server runs** (D-020). Web PowerSync workers are copied into `apps/web/public/@powersync/` by a `postinstall`; that dir is gitignored and regenerated.
- Dev servers (Next on some port, Metro on 8081) may still be running from this session; they are disposable.
- Money stays float rupees through `roundToPaise` (D-014); in the PowerSync client schema money is `column.real`, booleans are `column.integer`, timestamps/jsonb are `column.text`.

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
