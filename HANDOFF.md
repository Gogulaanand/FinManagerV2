# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

---

## Latest Handoff: 2026-07-17 (Phase 2 complete)

### Where we are

Phase 2 is complete and committed; nothing is half-done.
The tax calculator is a fully offline old-vs-new-regime tool for **FY 2026-27**, with the engine as pure, tested functions in `packages/core/src/tax` (rules as data, no per-year branches) and identical UI on web and mobile.
The scope changed from the plan mid-session (D-018): **FY 2026-27 only**, which turned out to be the first year under the **Income-tax Act, 2025** (new regime = s.202, rebate = s.156, no more "assessment year"). Every FY 2026-27 number was confirmed against the Finance Bill 2026 text and incometax.gov.in, not a third-party calculator.
Core is now 87 tests (was 20), all hand-computed from the statute. A real 24L salary was computed by eye on both platforms and matches the tests exactly.

### Exact next action

Start Phase 3 (Auth + Offline-First Data Layer): read `phases/briefing/phase-2.md`, then stand up the Supabase project and `packages/sync` (PowerSync). Part of this phase is migrating the tax scenarios out of localStorage/AsyncStorage (`apps/*/lib/tax-scenario.ts`) into the synced store so they attach to an account while still working before login.

### Files in flight

None. The working tree is clean and committed. See `phases/briefing/phase-2.md` for the full list.

### Open items / warnings

- **The tax engine ships FY 2026-27 only, under the Income-tax Act, 2025** (D-018). Any _older_ year added later must be modelled as a **1961 Act** rule set (different section numbers, "assessment year"), not by copying the 2026-27 table backwards. `FinancialYearRules.statute` and `rules.test.ts` carry this distinction.
- **Tax rules are data with per-rule citations; the statute is the only source** (D-019). `packages/core/src/tax/rules.ts`. A reference calculator the owner linked carried stale maths (50k standard deduction, pre-2024 CG rates, 1961 section numbers) while labelled FY 2026-27 - its UX idea was reused, none of its numbers. WebFetch's summariser also misread two _official_ values; always read the primary First Schedule table.
- **Government rate PDFs 403 on WebFetch.** Download with `curl -A "<browser UA>"`, extract with a Python venv + `pypdf` (`poppler`/`pdftotext` absent). Individual rates: Finance Bill First Schedule **Part I-B** (2025 Act) + **Paragraph F** (surcharge Tables 1 and 2).
- **`exactOptionalPropertyTypes` is on.** A UI prop typed `hint?: string` rejects a caller passing `undefined`. Type forwarded optionals `?: T | undefined`. Bit both platforms' field components this phase.
- **`react-hooks/set-state-in-effect` is enforced.** Do not load client-only state (localStorage) via `useEffect(() => setState(...))`. Web scenarios use `useSyncExternalStore` with a stable empty server snapshot - the SSR-correct shape.
- **Metro serves a stale cached bundle after code changes.** `simctl openurl exp://.../--/route` only navigates the running (old) bundle. To load new code: `simctl terminate host.exp.Exponent`, reopen the base `exp://` URL, and watch for a fresh `iOS Bundled` line before trusting the screen.
- **No touch input to the simulator here.** No `idb`; `simctl` has no tap/swipe; System Events UI scripting lacks assistive access (though plain `osascript` now runs, unlike the Phase 1 `-609` block). To verify below-the-fold RN screens, temporarily set a `ScrollView contentOffset` or a default state, screenshot, then revert - and grep to prove the revert landed before committing.
- **Money is float rupees with mandatory `roundToPaise`** (D-014). Every aggregation and rate calc in the tax engine passes through it. Still the rule for Phase 3+.
- **packages/tokens is the source of truth, not Stitch** (D-015); **never signal gain/loss by colour alone** (▲/▼ + sign); the "Best" regime badge follows this too. **Two Tailwind majors coexist** (D-016). **A dropped `text-*` utility = tailwind-merge lost the token scale** (D-017) - verified absent on the new web components this phase.
- **Do not "upgrade to latest" reflexively.** Pinned: TS 6.0.3, ESLint 9.39.5, React 19.2.3, Expo 57 (D-009, D-011, D-013). `@react-native-async-storage/async-storage@2.2.0` was added via `npx expo install` so SDK 57 picked the compatible version (D-020).
- `sample-data.ts` and both `lib/tax-scenario.ts` copies are deliberate duplication; all die in Phase 3 when `packages/sync` lands.
- No Supabase, PowerSync, Vercel, EAS, or Resend accounts wired yet; Phase 3 is where they land.

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
