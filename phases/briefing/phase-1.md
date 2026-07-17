# Phase 1 Briefing: Design System

Status: Done (2026-07-17, 1 session).
Read this instead of scanning the repo. Everything Phase 2 needs is listed below.

## What was built

### The design system: "FinManager Calm Teal"

Authored in Stitch (project `15700405983783543744`, design system `assets/10681403320511857968`).
Seed `#0F766E` deep teal, TONAL_SPOT, Manrope headlines + Inter body, 12px radius.
The reference dashboard screen Stitch generated is `projects/15700405983783543744/screens/f745f4a2c7054225a46d703e57cc039a`.

**packages/tokens is the source of truth for the apps, not Stitch.** Stitch is the design reference; two token values deliberately diverge from it (see D-015).

### packages/tokens (placeholder contents replaced wholesale)

- `src/color.ts` - `light`/`dark` `ColorScheme`s (11 semantic roles: background, surface, surfaceMuted, border, foreground, foregroundMuted, primary, primaryForeground, gain, loss, focus), `colorFor()`, `toRgbChannels()`.
- `src/typography.ts` - 9 type levels (`display-lg` … `caption`), `fontFamily`, `currencyTypeTokens`.
- `src/spacing.ts` - 4px grid keyed by multiplier (`spacing[4]` is 16px), `cardPadding` (16 mobile / 24 desktop).
- `src/radius.ts` - `none|sm|md|lg|xl|full`; 12px (`md`) is the default.
- `src/css.ts` - `toTailwindCss()`, emits the Tailwind **v4** theme for web.
- `src/nativewind.ts` - `toNativeWindCss()` + `nativeWindTheme()`, emits the Tailwind **v3** input and theme for mobile.
- `scripts/emit-css.mjs` - build step writing `dist/tokens.css`, `dist/nativewind.css`, `dist/nativewind-theme.cjs`.
- Tests (27): `color.test.ts` (16, computes real WCAG ratios), `css.test.ts` (7), `spacing.test.ts` (4).

Internal imports use explicit `.js` specifiers so the built package is importable by Node, not just a bundler. `moduleResolution: "Bundler"` emits extensionless paths that `node` cannot resolve; `emit-css.mjs` is the first thing to import a package directly.

### packages/core (extended)

- `src/format.ts` - `formatInr()` (Indian lakh/crore via `en-IN`), `formatDelta()`, `directionOf()`. Tests: `format.test.ts` (15).

### apps/web - Next 16 + Tailwind v4 + shadcn-style primitives

- `src/app/globals.css` - `@import 'tailwindcss'` + `@import '@finmanager/tokens/tokens.css'` + `@custom-variant dark`.
- `src/app/layout.tsx` - next/font (Manrope, Inter), sidebar + tab bar + header, no-flash theme script.
- `src/app/page.tsx` - dashboard; `tax|expenses|portfolio|goals|settings/page.tsx` - designed module placeholders.
- `src/components/` - `amount.tsx` (`Amount`, `Delta`), `sidebar.tsx` (`Sidebar`, `TabBar`), `theme-toggle.tsx`, `module-placeholder.tsx`, `ui/button.tsx`, `ui/card.tsx`.
- `src/lib/` - `utils.ts` (`cn`, token-aware tailwind-merge, D-017), `nav.ts` (the six modules), `sample-data.ts`.

shadcn/ui was **not** initialised via its CLI: `init` rewrites `globals.css` with its own theme and would have destroyed the token pipeline. The primitives are hand-built on the same foundation (radix Slot, CVA, clsx, tailwind-merge, lucide-react).

### apps/mobile - Expo SDK 57 + NativeWind 4 + Tailwind v3

- `tailwind.config.js` - adapter; requires `@finmanager/tokens/nativewind-theme`, `darkMode: 'class'`.
- `global.css` - one-line `@import '@finmanager/tokens/dist/nativewind.css'` (path form is required, see D-016).
- `metro.config.js` - existing monorepo config + `withNativeWind`.
- `babel.config.js` - `jsxImportSource: 'nativewind'` + `nativewind/babel`.
- `app/_layout.tsx` - font loading (Manrope 600/700/800, Inter 400/500), holds render until faces load.
- `app/(tabs)/_layout.tsx` - six-tab bar; `index|tax|expenses|portfolio|goals|settings.tsx`.
- `components/` - `amount.tsx`, `card.tsx`, `module-placeholder.tsx`. `lib/sample-data.ts`.
- `nativewind-env.d.ts`. Old `app/index.tsx` deleted.

react-native-reusables was **not** used: its CLI (`@react-native-reusables/cli`, last published 2026-03-14) is a shadcn-style code-copier, not a runtime dep, and the three primitives this shell needs were smaller hand-written than adapted. Revisit when the feature phases need real form controls.

## Verification evidence

- `pnpm turbo run build test lint typecheck` -> **17/17 successful**. `pnpm format:check` clean. **51 tests** passing (core 20, tokens 27, schema 4), up from 11 in Phase 0.
- **Web** (`next dev`, localhost:3100, Chrome): dashboard renders; hero verified at computed `40px` / weight `800` / Manrope; light and dark both correct; the theme toggle provably overrides the system preference (system dark + click Light -> `rgb(244,247,247)` and `.light` on `<html>`, persisted).
- **Mobile** (Expo Go on iPhone 17 Pro simulator, iOS 26.3): `iOS Bundled 5569ms (1763 modules)`; dashboard renders with tokens, Manrope, and correct lakh grouping; dark mode verified; deep-link navigation to `/portfolio` switches the active tab.

**The Phase 0 mobile gap is closed** - the app has now run on a simulator, not just bundled.

## Pitfalls that cost time (do not rediscover these)

1. **tailwind-merge silently ate the type scale.** `text-display-lg` + `text-foreground` read as one `text-*` group, so every amount rendered at 16px. Types, lint, and tests were all green - only the screen showed it. Fixed in `cn()` (D-017).
2. **next/font variables must be on `<html>`, not `<body>`.** `@theme` declares `--font-display` on `:root`, and a `:root` var cannot resolve a var defined on `<body>` - it silently used the fallback.
3. **Tailwind v3's postcss-import ignores the `exports` field.** `@import '@finmanager/tokens/nativewind.css'` fails; `.../dist/nativewind.css` works. Tailwind v4 honours exports, so only mobile is affected.
4. **This environment blocks AppleScript** (`osascript` -> `-609`), so `expo start --ios` always dies in `isSimulatorAppRunningAsync`. Working recipe: `xcrun simctl boot <udid>`, `open -a Simulator`, install Expo Go, run `npx expo start` **without** `--ios` from `apps/mobile`, then `xcrun simctl openurl <udid> "exp://127.0.0.1:8081"`.
5. **Expo Go must be the SDK-matched build.** The `iosUrl` on `api.expo.dev/v2/versions/latest` is a legacy client with no arm64 slice and fails to install on iOS 26. The right one is `sdkVersions['57.0.0'].iosClientUrl` (`Expo-Go-57.0.5.tar.gz`). The tarball extracts bundle _contents_, so `cp -R` it to `ExpoGo57.app` before `simctl install`.
6. **Background installs killed sibling background jobs.** A concurrent `pnpm add` silently took down the Metro process mid-"Fetching Expo Go". Run installs to completion before starting servers, and check artifacts, not exit codes (a Phase 0 lesson that held again).
7. **Numeric object keys reorder.** `spacing` with `0.5`/`1.5` keys iterated as `[0,4,8,…,2,6]` - integer-like keys sort first. Fractional steps were dropped.

## Union of files touched

```
DECISIONS.md                     (appended D-015..D-017)
HANDOFF.md                       (rewritten)
STATUS.md                        (updated)
eslint.config.mjs                (scripts/** get Node globals)
phases/briefing/phase-1.md       (this file)
packages/tokens/package.json     (exports + build emits CSS)
packages/tokens/scripts/emit-css.mjs
packages/tokens/src/{index,color,typography,spacing,radius,css,nativewind}.ts
packages/tokens/src/{color,css,spacing}.test.ts
packages/core/src/{index,format}.ts
packages/core/src/format.test.ts
apps/web/package.json
apps/web/src/app/{layout.tsx,globals.css,page.tsx}
apps/web/src/app/{tax,expenses,portfolio,goals,settings}/page.tsx
apps/web/src/components/{amount,sidebar,theme-toggle,module-placeholder}.tsx
apps/web/src/components/ui/{button,card}.tsx
apps/web/src/lib/{utils,nav,sample-data}.ts
apps/mobile/package.json
apps/mobile/{tailwind.config.js,global.css,metro.config.js,babel.config.js,nativewind-env.d.ts}
apps/mobile/app/_layout.tsx
apps/mobile/app/(tabs)/{_layout,index,tax,expenses,portfolio,goals,settings}.tsx
apps/mobile/components/{amount,card,module-placeholder}.tsx
apps/mobile/lib/sample-data.ts
apps/mobile/app/index.tsx        (deleted, superseded by (tabs)/index.tsx)
pnpm-lock.yaml
```

`sample-data.ts` is duplicated in both apps on purpose - it is Phase 1 scaffolding with no data layer behind it, and both copies die in Phase 3.

## Next phase, copied verbatim from PRODUCTION_PLAN.md

### Phase 2: Tax Calculator - India

Estimated effort: 1-2 sessions.

- `packages/core/tax`: FY 2025-26 (and 2024-25) rule sets as data; old vs new regime; salary decomposition (basic, HRA, allowances), 80C/80D/80CCD, standard deduction, surcharge + cess, professional tax; monthly in-hand output.
- Easy mode: CTC in, in-hand + regime comparison out. Advanced mode: full component-level configuration, multiple named scenarios side by side (the Vercel calculator reference UX).
- Exhaustive unit tests against hand-verified numbers before any UI.
- UI on web + mobile. Works fully offline and before login (scenarios persist locally; attach to account after auth exists).

Exit criteria: compute and compare real in-hand salary on both platforms; tests green; briefing written.
