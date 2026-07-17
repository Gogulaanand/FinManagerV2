# Session Handoff

Rewritten at the end of every working session.
This file carries mid-phase state between sessions; completed phases live in phases/briefing/phase-N.md instead.

---

## Latest Handoff: 2026-07-17 (Phase 0 review session)

### Where we are

Phase 0 is complete, committed, and independently reviewed; nothing is half-done.
The review re-verified every Phase 0 claim hands-on (cold 17/17 turbo tasks, 11 tests, format clean, CI green on GitHub, hoisting effective with a single React 19.2.3 copy, `expo export` re-run producing a clean 2.8MB Hermes bundle).
Three review findings were fixed in this session: the web dark-mode CSS bug (see warning below), a stale `.npmrc` comment in `apps/mobile/metro.config.js`, and the money representation is now an explicit decision (D-014).

### Exact next action

Start Phase 1 (Design System): read `phases/briefing/phase-0.md`, then begin with Stitch MCP - create the project and generate the design system.
Before building on it, spend two minutes booting the Expo app on a device/simulator (`pnpm mobile`) - see the warning below.

### Files in flight

None. The working tree is clean and committed. See `phases/briefing/phase-0.md` for the full list of files created.

`packages/tokens` currently holds only a placeholder spacing scale. Phase 1 is expected to replace its contents wholesale, not extend them.

### Open items / warnings

- **Tailwind v4: never nest `@theme` inside `@media`.** It does not error - it silently merges the nested block into the base theme, which made the web app permanently dark in Phase 0. Correct pattern (now in `apps/web/src/app/globals.css`): light values in a top-level `@theme`, dark overrides on the plain CSS variables in `@media (prefers-color-scheme: dark) { :root { ... } }`. Phase 1 must carry this pattern into the design system.
- **Expo Go on a real device was not verified.** Metro serves the correct bundle over HTTP and `expo export` bundles clean, but no phone or simulator has been attached (the dev machine has no iOS simulators installed). Confirm this early in Phase 1 before layering a design system on top.
- **Money is float rupees with mandatory `roundToPaise` after every aggregation** - see D-014 before writing any Phase 2+ math.
- **Do not "upgrade to latest" reflexively.** TypeScript 7 and ESLint 10 are published but break typescript-eslint; React 19.2.7 conflicts with Expo. Pinned: TS 6.0.3, ESLint 9.39.5, React 19.2.3. See D-009, D-011, D-013.
- **`nodeLinker: hoisted` lives in `pnpm-workspace.yaml`, never `.npmrc`** - pnpm 11 ignores the `.npmrc` key silently and Metro then breaks (D-010).
- Port 3000 was occupied by an unrelated process, so `next dev` fell back to 3002. Not a repo problem.
- No Supabase, PowerSync, Vercel, EAS, or Resend accounts wired yet; none needed until Phase 3.
- CI is verified green on GitHub. Repo: https://github.com/Gogulaanand/FinManagerV2 (private).

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
