# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

---

## Latest Handoff: 2026-07-18 (Phase 4 complete)

### Where we are

Phase 4 is implemented and committed on branch `phase-4-expenses` (latest feature commit `62deaa3`, followed by the final provider/docs commit). The app now has real expenses and budgeting flows on both platforms: accounts, seeded categories, concrete transactions with CRUD, amount-first mobile entry, recurring materialization, monthly budget progress/overspend states, shared chart math, native/web charts, CSV mapping previews, synced profile mappings, and canonical import deduplication.
The repo-wide gate is green: `pnpm turbo run build test lint typecheck` completed 21/21 tasks and `pnpm format:check` is clean. Core has 97 tests and sync has 14 tests. The web production build no longer emits the Phase 3 PowerSync SSR exceptions after moving the provider behind a browser-only client boundary. Expo iOS export also completed.

### Exact next action

Start Phase 5 (Portfolio + Investments): read `phases/briefing/phase-4.md` and only the files it lists. Before portfolio work, apply and verify `supabase/migrations/20260718000001_phase4_expenses.sql`; this worktree could not run `supabase migration list` because no project ref is linked.

### Files in flight

None after the final handoff commit. See `phases/briefing/phase-4.md` for the full Phase 4 file list.

### Open items / warnings

- **Phase 4 migration is not applied or remotely verified from this worktree.** The repository has the migration file, but `supabase migration list` reports that no project ref is linked. Link the intended project and apply it before using recurrence/import fields against Supabase.
- **Chrome verification was unavailable:** the Chrome control connector could not connect, so the web route was verified by production build/prerender only. Do not call that a signed-in end-to-end Chrome pass.
- **Mobile interactive verification remains outstanding:** Expo iOS export passed, but the simulator has no touch input. Run the keypad, CRUD, budget, and airplane-mode sync path on a real Expo Go device.
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
