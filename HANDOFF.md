# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

---

## Latest Handoff: 2026-07-18 (Phase 5 complete, session 1)

### Where we are

Phase 5 is implemented on branch `phase-5-portfolio` in the existing Phase 4 worktree. The app now has portfolio holdings and typed metadata for listed assets, real estate, RSU/ESOP, retirement products, and cash; dated FX-aware cash-flow events; valuation history; true XIRR and incomplete-state reporting; account-inclusive net worth; allocation and gain/loss summaries; Zerodha/CAMS/KFintech CSV previews with semantic deduplication; concrete online quote refresh with provenance; and offline-first web/mobile CRUD through the existing PowerSync repositories.
The repo-wide gate is green: `CI=true pnpm turbo run build test lint typecheck` completed 21/21 tasks, `CI=true pnpm format:check` is clean, and `CI=true pnpm --filter @finmanager/mobile exec expo export --platform ios` completed successfully. Focused package results are schema 13 tests, core 112 tests, and sync 21 tests. The web production build generated `/portfolio` successfully. The linked Supabase migration check could not run because this worktree has no linked project ref; the Phase 4 migration was not rerun.

### Exact next action

Run the combined Phase 4 + Phase 5 Chrome/Expo Go verification prompt below with the existing signed-in test account, then apply and verify `supabase/migrations/20260718000002_phase5_portfolio.sql` in the intended linked Supabase project. After that, start Phase 6 using `phases/briefing/phase-5.md`.

### Files in flight

The Phase 5 implementation files are listed in `phases/briefing/phase-5.md`. The current working tree is ready for the final pre-commit review and commit.

### Open items / warnings

- **Phase 4 migration remains untouched.** The Phase 5 migration is additive at `supabase/migrations/20260718000002_phase5_portfolio.sql`; `supabase migration list --linked` could not be used here because no project is linked. Apply only the Phase 5 migration in the intended linked project and inspect constraints/indexes/RLS before shared-device testing.
- **Chrome verification was unavailable:** the Chrome control connector could not connect, so the web route was verified by production build/prerender only. Do not call that a signed-in end-to-end Chrome pass.
- **Mobile interactive verification remains outstanding:** Expo iOS export passed, but the simulator has no touch input. Run the keypad, CRUD, budget, and airplane-mode sync path on a real Expo Go device.
- **Supabase email confirmation is ON and the built-in mailer is rate-limited**, so real signups can't complete. The Phase 3 web E2E confirmed its test account via a direct `email_confirmed_at` SQL update. Fix with SMTP/Resend (the planned email provider) or a deliberate toggle at Phase 9 (D-024).
- **A Phase 3 test account with two synced scenarios remains in Supabase.** Credentials are intentionally omitted from tracked docs. Rotate or delete that account after cross-platform verification with explicit operator approval; it is test pollution otherwise.
- **Google sign-in is web-only.** Mobile needs the expo-web-browser + deep-link OAuth flow; deferred (email/password works on mobile).
- **PowerSync tables are SQLite views: no UPSERT.** Use UPDATE-then-INSERT (see `saveScenario`). Any new jsonb column must be added to `JSON_COLUMNS` in `packages/sync/src/schema.ts` or its writes fail at PostgREST (D-022).
- **Mobile uses the sql-js PowerSync adapter to stay in Expo Go (D-021), which is in-memory** - local data re-syncs from Supabase rather than persisting across relaunch. The OP-SQLite swap (native, encrypted, persistent) is a Phase 9 task and is localized to `apps/mobile/lib/powersync.ts`.
- **Phase 5 interactive verification remains outstanding:** the combined prompt below must be run in a real Chrome session and on a real Expo Go device. The no-touch simulator and unavailable Chrome connector prevented claiming this manual pass.
- **Phase 5 FX and quote rules:** non-INR events and valuations require dated `fxRateToInr`; manual value/price overrides win over automatic quotes; quote refresh is online-only and persists provenance without replacing manual fields.
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
