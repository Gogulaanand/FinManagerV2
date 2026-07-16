# Phase 0 Briefing: Monorepo Foundation

Status: Done (2026-07-17, 1 session).
Read this instead of scanning the repo. Everything Phase 1 needs is listed below.

## What was built

### Workspace root

- `pnpm-workspace.yaml` - workspaces (`apps/*`, `packages/*`), `nodeLinker: hoisted`, `allowBuilds` for sharp + unrs-resolver.
- `package.json` - root scripts (`build`, `test`, `lint`, `typecheck`, `check`, `format`, `web`, `mobile`), shared devDeps, `packageManager: pnpm@11.10.0`, Node >=22.
- `turbo.json` - `build`/`test`/`lint`/`typecheck` tasks, each `dependsOn: ["^build"]` so packages build before consumers.
- `tsconfig.base.json` - TS strict base, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `verbatimModuleSyntax`.
- `eslint.config.mjs` - flat config; syntactic typescript-eslint `recommended` + prettier; CommonJS/Node override for `*.config.js`.
- `.prettierrc.json`, `.prettierignore`, `.gitignore`.
- `.github/workflows/ci.yml` - on push to main + all PRs: install, build, test, lint, typecheck, `format:check`.

There is deliberately **no `.npmrc`** - see D-010.

### packages/ (each: strict TS, `tsc` build to `dist`, one sample function + passing Vitest suite)

- `packages/core` - `src/money.ts` (`roundToPaise`, half-away-from-zero, float-error safe), `src/money.test.ts` (5 tests), `src/index.ts`.
- `packages/schema` - `src/money.ts` (`CurrencyCodeSchema`, `MoneySchema` via zod 4, defaults INR), `src/money.test.ts` (4 tests), `src/index.ts`.
- `packages/tokens` - `src/spacing.ts` (placeholder `spacing` scale + `space()`), `src/spacing.test.ts` (2 tests), `src/index.ts`. **Phase 1 replaces this with the real Stitch-derived design system.**

Each package has `tsconfig.json` (typecheck, `noEmit`) and `tsconfig.build.json` (emit; owns `rootDir`/`outDir`). Keep `rootDir` out of `tsconfig.json` or typecheck breaks on `vitest.config.ts`.

### apps/web - Next.js 16 + Tailwind v4

- `src/app/page.tsx` - placeholder importing from all three packages; renders `INR 1,23,456.79`.
- `src/app/layout.tsx`, `src/app/globals.css` (Tailwind v4 `@import 'tailwindcss'` + `@theme`, dark mode via `prefers-color-scheme`).
- `next.config.ts` (`reactStrictMode`, `typedRoutes`), `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs`.

### apps/mobile - Expo SDK 57 + expo-router

- `app/_layout.tsx` (Stack + StatusBar), `app/index.tsx` (placeholder mirroring web, imports all three packages).
- `app.json` (scheme `finmanager`, typed routes, new arch), `babel.config.js`, `tsconfig.json`, `eslint.config.mjs`.
- `metro.config.js` - **monorepo-critical**: `watchFolders` = workspace root, `nodeModulesPaths` = app + root.

## Verification evidence (all re-run cold at end of session)

- `pnpm turbo run build test lint typecheck --force` -> **17/17 tasks successful, 0 warnings**.
- `pnpm format:check` -> clean.
- 11 tests passing across core (5), schema (4), tokens (2).
- **Web**: `next dev` -> `HTTP 200`, served HTML contains `INR 1,23,456.79`, proving core + schema + tokens resolve through the Next bundler.
- **Mobile**: `expo export --platform ios` bundles clean; `expo start` serves `HTTP 200` (6.7MB) at the exact `expo-router/entry.bundle` URL Expo Go requests, containing the app screen and all three packages' code.

**Not verified**: the app running in Expo Go on a physical device / simulator. Metro serves the correct bundle over HTTP, but no device was attached this session. Worth a 2-minute sanity check at the start of Phase 1.

## Pitfalls that cost time (do not rediscover these)

1. **`nodeLinker` must be in `pnpm-workspace.yaml`.** pnpm 11 silently ignores `node-linker=hoisted` in `.npmrc` - installs stayed isolated with no warning, and Metro then failed to resolve `whatwg-fetch`. Verify with `pnpm config get node-linker`.
2. **The toolchain "latest" is ahead of the ecosystem.** TypeScript 7 and ESLint 10 are published but break typescript-eslint. Pins: TS 6.0.3, ESLint 9.39.5, React 19.2.3. See D-009, D-011, D-013.
3. **React is workspace-wide, not per-app.** Hoisting means one physical copy; Expo is the pickiest consumer. `npx expo install --check` is the authority before any React/TS bump.
4. **`@types/react-dom` versions independently of `react-dom`** (19.2.3, not 19.2.7).
5. **Background command exit codes lied** - a failed `pnpm install` reported exit 0. Verify against artifacts (lockfile, `node_modules`), not status codes.

## Union of files touched

```
.github/workflows/ci.yml
.gitignore
.prettierignore
.prettierrc.json
DECISIONS.md                     (appended D-008..D-013)
HANDOFF.md                       (rewritten)
STATUS.md                        (updated)
eslint.config.mjs
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
turbo.json
phases/briefing/phase-0.md       (this file)
apps/web/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,eslint.config.mjs}
apps/web/src/app/{layout.tsx,page.tsx,globals.css}
apps/mobile/{package.json,app.json,babel.config.js,metro.config.js,tsconfig.json,eslint.config.mjs}
apps/mobile/app/{_layout.tsx,index.tsx}
packages/core/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}
packages/core/src/{index.ts,money.ts,money.test.ts}
packages/schema/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}
packages/schema/src/{index.ts,money.ts,money.test.ts}
packages/tokens/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}
packages/tokens/src/{index.ts,spacing.ts,spacing.test.ts}
```

`packages/sync` is intentionally absent - it is a Phase 3 concern.

## Next phase, copied verbatim from PRODUCTION_PLAN.md

### Phase 1: Design System

Estimated effort: 1-2 sessions.

- Use Stitch MCP: create project, generate design system + key screens (dashboard, expense entry, portfolio, tax calculator) for mobile and web.
- Extract tokens into `packages/tokens`; wire into Tailwind config (web) and NativeWind (mobile).
- shadcn/ui initialized on web with themed primitives; react-native-reusables equivalents on mobile.
- App shell both platforms: tab/side navigation for the six modules, dark/light mode, typography and spacing locked.

Exit criteria: navigable shell on both platforms that already looks production-grade; briefing written.
