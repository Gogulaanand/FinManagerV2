# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

---

## Latest Handoff: 2026-07-17 (Phase 1 complete)

### Where we are

Phase 1 is complete and committed; nothing is half-done.
The "Calm Teal" design system is authored in Stitch and extracted into `packages/tokens`, which is now the single source of truth for both platforms: it emits Tailwind v4 CSS for web and a Tailwind v3 input plus theme for mobile, so neither app restates a token value.
Both apps render a navigable six-module shell (dashboard, tax, expenses, portfolio, goals, settings) in light and dark mode, and both were verified by eye, not just by a green pipeline.
The Phase 0 mobile gap is closed: the app has now run in Expo Go on an iOS 26.3 simulator.

### Exact next action

Start Phase 2 (Tax Calculator): read `phases/briefing/phase-1.md`, then begin with `packages/core/tax` - the FY 2025-26 and 2024-25 rule sets as data, with hand-verified unit tests written before any UI.
The shell already has a Tax route on both platforms (`apps/web/src/app/tax/page.tsx`, `apps/mobile/app/(tabs)/tax.tsx`); both currently render `ModulePlaceholder` and are meant to be replaced wholesale.

### Files in flight

None. The working tree is clean and committed. See `phases/briefing/phase-1.md` for the full list.

### Open items / warnings

- **packages/tokens is the source of truth, not Stitch.** Two values deliberately diverge (D-015): light-mode `gain` is emerald-700 `#047857`, not the `#059669` the Stitch asset names, because 600 fails WCAG AA on white. Do not "correct" tokens back to match Stitch.
- **Never signal gain/loss by color alone.** The two hues sit ~1.17:1 apart in luminance - indistinguishable in greyscale and to a red-green colorblind user. The sign and the ▲/▼ glyph carry the meaning. `Amount`/`Delta` on both platforms already enforce this; any new money UI must too.
- **Two Tailwind majors coexist** (D-016): web on v4, mobile on v3 + NativeWind 4. This is deliberate - NativeWind's only v4-capable line is a preview whose releases lag its own stable line. Mobile's `global.css` must import `@finmanager/tokens/dist/nativewind.css` (path form); Tailwind v3's postcss-import ignores the `exports` field.
- **A silently-dropped `text-*` utility means tailwind-merge lost the token scale** (D-017). It once rendered every currency figure at 16px instead of 40px with types, lint, and tests all green. `cn()` is configured from the token objects; keep it that way.
- **Tailwind v4: never nest `@theme` inside `@media`.** It does not error - it merges into the base theme and kills light mode. `packages/tokens/src/css.test.ts` now pins the correct shape as an executable guard.
- **`expo start --ios` cannot work in this environment.** AppleScript is blocked (`osascript` -> `-609`), so it always dies in `isSimulatorAppRunningAsync`. Working recipe is in the briefing, pitfall 4: boot via `simctl`, start Metro **without** `--ios` from `apps/mobile`, then `xcrun simctl openurl <udid> "exp://127.0.0.1:8081"`. Expo Go must be the SDK-57 build (`sdkVersions['57.0.0'].iosClientUrl`), not the legacy `iosUrl`, which has no arm64 slice.
- **Do not run `pnpm add` while a dev server is up.** A concurrent install silently killed Metro mid-download this session. Phase 0's lesson held again: verify artifacts, not exit codes.
- **Money is float rupees with mandatory `roundToPaise` after every aggregation** - see D-014 before writing the tax math. `formatInr` in packages/core already rounds before display.
- **Do not "upgrade to latest" reflexively.** Pinned: TS 6.0.3, ESLint 9.39.5, React 19.2.3 (D-009, D-011, D-013). Expo also reports 57.0.6 -> 57.0.7 available; not taken this session, and `npx expo install --check` is the authority before any bump.
- `sample-data.ts` is duplicated in both apps on purpose. It is Phase 1 scaffolding; both copies die in Phase 3 when the sync layer lands.
- shadcn/ui and react-native-reusables were not installed via their CLIs - the reasoning is in the briefing. The web foundation (radix Slot, CVA, clsx, tailwind-merge) is in place, so `npx shadcn add <component>` can still be used later if its output is pointed at the tokens.
- No Supabase, PowerSync, Vercel, EAS, or Resend accounts wired yet; none needed until Phase 3.

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
