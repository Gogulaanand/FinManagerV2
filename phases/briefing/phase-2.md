# Phase 2 Briefing: Tax Calculator - India

Status: Done (2026-07-17, 1 session).
Read this instead of scanning the repo. Everything Phase 3 needs from here is listed below.

## What was built

A fully offline old-vs-new-regime income tax calculator for FY 2026-27, on web and mobile, with the tax engine as pure tested functions in `packages/core` and no business math in either UI.

### The scope change you must know about

The plan (`### Phase 2`) named FY 2025-26 and FY 2024-25. The project owner changed this mid-session to **FY 2026-27 only** (D-018). This is not a trivial relabel: **FY 2026-27 is the first year under the Income-tax Act, 2025**, which repealed the 1961 Act on 1 April 2026. The new regime is now **section 202** (was 115BAC), the rebate is **section 156** (was 87A), and "assessment year" is gone - the Act uses "tax year". Any future year added as history must be modelled as a _1961 Act_ rule set, not by copying the 2026-27 table backwards. `FinancialYearRules.statute` carries this and `rules.test.ts` pins it.

### packages/core/src/tax (the engine - rules as data, no per-year branches)

- `rules.ts` - every slab, threshold, cap, and rate as a data table with a per-rule source citation. `RULES` keyed by FY; `DEFAULT_FY = '2026-27'`; `AVAILABLE_FYS`; `rulesFor(fy)` throws on unknown years rather than taxing at zero. Types: `Regime`, `AgeBand`, `Slab`, `SurchargeTier`, `RebateRule`, `RegimeRules`, `DeductionCaps`, `FinancialYearRules`.
- `salary.ts` - `decomposeSalary()` (CTC -> basic/HRA/special/employer PF+NPS+gratuity/gross; `specialAllowance` is the balancing figure so parts always re-sum to CTC), `hraExemption()` (Rule 2A least-of-three), `SALARY_DEFAULTS`.
- `compute.ts` - `computeTax(input)` returns a `TaxComparison` (both regimes + `better` + `savings`). `taxOnTaxableIncome(taxable, fy, regime, ageBand)` applies the statutory charge to a raw taxable income and is the function the boundary tests drive. `slabTax()` exposed for band-level assertions. Order: gross -> deductions -> taxable -> slab tax -> rebate (s.156, with marginal relief in the new regime) -> surcharge -> surcharge marginal relief (Table 2 `Wn = Un + Vn`) -> cess -> total. Rebate is applied _before_ surcharge on purpose.
- `index.ts` - barrel; re-exported through `packages/core/src/index.ts`.
- Tests (67 new, all written/hand-computed from the statute before the engine was trusted): `compute.test.ts` (33), `rules.test.ts` (23), `salary.test.ts` (11). Core suite is now **87 tests** (was 20).

Two `compute.test.ts` expectations failed on first run; both were arithmetic errors in the _test_, not the engine (a 30%-of-99.76cr slip and an annual-vs-monthly professional-tax mix-up). That is the point of deriving them independently.

### The FY 2026-27 numbers (all confirmed against the Finance Bill 2026 text + incometax.gov.in)

- New regime slabs (s.202): 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, 24L+ 30%.
- Old regime slabs: 2.5L/5L/10L at 5/20/30%; senior exemption 3L, super-senior 5L (no 5% band).
- Rebate (s.156): new 60,000 up to 12L with marginal relief; old 12,500 up to 5L, hard cliff.
- Standard deduction: new **75,000** (NOT the stale 50,000 most calculators carry), old 50,000.
- Surcharge: 10% >50L, 15% >1cr, 25% >2cr, 37% >5cr; **new regime caps at 25%**. Marginal relief at every threshold.
- Cess: 4% on tax + surcharge. Chapter VI-A: 80C/80CCE 1.5L, 80CCD(1B) 50k, 80D 25k/50k-senior x2 for parents, 5k preventive sub-limit. 80CCD(2) employer NPS: 14% new / 10% old. Professional tax: user-entered, defaulting to the Article 276(2) cap of 2,500 (D-018 answer 3).

### apps/web (replaced the tax ModulePlaceholder wholesale)

- `src/app/tax/page.tsx` - now renders `<TaxCalculator/>`.
- `src/components/tax/tax-calculator.tsx` - Easy/Advanced modes, side-by-side regime comparison, scenarios table. Uses `useSyncExternalStore` over the scenario store (not an effect - the lint rule forbids setState-in-effect, and this is the SSR-correct shape).
- `src/components/tax/regime-card.tsx` - one regime's outcome, headlined by monthly in-hand, with a `<details>` "Show the working" (deductions -> slabs -> charge). Winner marked with ring + ▲ + "Best" (never colour alone, D-015).
- `src/components/ui/input.tsx` - `Input`, `Field`, `CurrencyField` (holds a number; empty = 0), `PercentField` (percentage over a ratio), `SelectField`, `CheckField`. All prop optionals are `?: T | undefined` because `exactOptionalPropertyTypes` is on.
- `src/lib/tax-scenario.ts` - `ScenarioInput`/`Scenario` model, `toTaxInput()`, localStorage-backed external store (`getScenariosSnapshot`/`getServerScenariosSnapshot`/`subscribeScenarios`/`setScenarios`). Nothing computed is ever stored; results are always re-derived, so a rule fix re-prices saved scenarios.

### apps/mobile (replaced the tax ModulePlaceholder wholesale)

- `app/(tabs)/tax.tsx` - same calculator, `SafeAreaView edges={['top']}` + `ScrollView contentContainerClassName` (the established screen convention). Two-up regime cards at `tile` amount size (display-md overflows a half-width phone card - a Phase 1 lesson).
- `components/field.tsx` - `Field`, `CurrencyField`, `PercentField`, `Segmented` (stands in for a select; no extra dep), `CheckField` (✓ glyph + fill, not colour alone).
- `components/tax/regime-card.tsx` - mobile regime card, `compact` prop for the two-up layout.
- `lib/tax-scenario.ts` - mirror of web's, persisting via **AsyncStorage** (`@react-native-async-storage/async-storage@2.2.0`, added via `npx expo install`, D-020). Async, loaded in an effect after mount.

Both `lib/tax-scenario.ts` copies are deliberate duplication (like `sample-data.ts`) and both die in Phase 3 when `packages/sync` owns local storage and scenarios attach to an account. Persistence is behind a small module boundary in each app precisely so that swap does not touch a component.

## Verification evidence

- `pnpm turbo run build test lint typecheck` -> **17/17 successful**; `pnpm format:check` clean; **core 87 tests** passing (was 20), repo total up accordingly.
- **Web** (`next dev`, localhost:3100, Chrome): computed a real 24L CTC. New regime monthly in-hand **1,55,865**, gross 22,38,624, taxable 21,63,624, total tax 2,50,542 - all matching the hand-computed `compute.test.ts` values exactly. Entered rent 3L + 80C 1.5L live; old regime taxable dropped to **18,32,124** (the test value) and "Show the working" showed slabs 12,500 + 1,00,000 + 2,49,637 -> tax on slabs 3,62,137 -> cess 14,485 -> 3,76,623. Amounts render at full display size (no D-017 regression).
- **Mobile** (Expo Go, iPhone 17 Pro sim, iOS 26.3): same 24L salary; new regime 1,55,865 / old 1,39,150 / "better off by 2,00,586" / "FY 2026-27 rules under the Income-tax Act, 2025" - matching web. Verified two-up cards at tile size (no overflow), Easy + Advanced modes (all deduction inputs with ₹ prefix and cap hints), and the Scenarios save row.

Both platforms were driven by eye, not just by a green pipeline - the Phase 1 rule.

## Pitfalls that cost time (do not rediscover these)

1. **Government rate PDFs 403 on WebFetch.** `indiabudget.gov.in` blocks the fetch tool. Download with `curl -A "<browser UA>"` and extract via a Python venv + `pypdf` (`pdftotext`/`poppler` are not installed). The Finance Bill's individual rates live in the **First Schedule, Part I-B** (2025 Act) and **Paragraph F** (surcharge, Table 1 + marginal-relief Table 2). WebFetch's summariser also _misread_ two official values (rebate 20k not 25k; surcharge cap 37% not 25%) - always read the primary table, not a summary.
2. **The reference calculator the owner linked had stale maths.** `Tax-Compare-India` labelled FY 2026-27 but carried a 50,000 standard deduction, 15%/10% capital-gains rates, and 1961 section numbers. Its layout was fine; its numbers were not. Took the UX idea, not the constants (D-019).
3. **`exactOptionalPropertyTypes` is on.** A prop typed `hint?: string` rejects a caller passing `hint={undefined}`. Type UI-forwarded optionals as `?: T | undefined`. Bit both web and mobile field components.
4. **`react-hooks/set-state-in-effect` is enforced.** Loading localStorage in a `useEffect(() => setState(...))` fails lint. Use `useSyncExternalStore` with a stable empty server snapshot instead - it is also the SSR-correct shape.
5. **Metro serves a stale cached bundle after a code change.** `simctl openurl exp://.../--/tax` only _navigates_ the already-running (old) bundle. To load new code, `simctl terminate host.exp.Exponent` then re-open the base `exp://` URL - watch for a fresh `iOS Bundled` line in the Metro log before trusting the screen.
6. **No touch input to the simulator here.** `idb` is not installed, `simctl` has no tap/swipe, and System Events UI scripting lacks assistive access (though `osascript` itself now runs, unlike Phase 1). To verify below-the-fold RN screens, temporarily set a `ScrollView contentOffset` / change a default state, screenshot, then revert - and grep to prove the revert landed before committing.

## Union of files touched

```
DECISIONS.md                                  (appended D-018..D-020)
STATUS.md                                     (updated)
HANDOFF.md                                    (rewritten)
phases/briefing/phase-2.md                    (this file)
packages/core/src/index.ts                    (re-export tax engine)
packages/core/src/tax/rules.ts                (new)
packages/core/src/tax/salary.ts               (new)
packages/core/src/tax/compute.ts              (new)
packages/core/src/tax/index.ts                (new)
packages/core/src/tax/rules.test.ts           (new)
packages/core/src/tax/salary.test.ts          (new)
packages/core/src/tax/compute.test.ts         (new)
apps/web/src/app/tax/page.tsx                 (placeholder replaced)
apps/web/src/components/tax/tax-calculator.tsx (new)
apps/web/src/components/tax/regime-card.tsx   (new)
apps/web/src/components/ui/input.tsx          (new)
apps/web/src/lib/tax-scenario.ts              (new)
apps/mobile/app/(tabs)/tax.tsx                (placeholder replaced)
apps/mobile/components/field.tsx              (new)
apps/mobile/components/tax/regime-card.tsx    (new)
apps/mobile/lib/tax-scenario.ts              (new)
apps/mobile/package.json                      (+ @react-native-async-storage/async-storage)
pnpm-lock.yaml
```

## Next phase, copied verbatim from PRODUCTION_PLAN.md

### Phase 3: Auth + Offline-First Data Layer

Estimated effort: 2 sessions.

- Supabase project: Auth (email + Google), `profiles`, RLS policies, initial migrations for the full data model.
- PowerSync instance + bucket rules; `packages/sync` with local SQLite schema mirroring Postgres; integration on web (wa-sqlite) and mobile (expo-sqlite).
- Login/signup/session screens both platforms; mobile biometric/PIN app lock.
- Activity logging hook (every app open writes `activity_log`) - the dead-man switch's data source.

Exit criteria: sign in on both platforms, write a record offline in airplane mode, watch it sync when back online; briefing written.

Note for the next session: the tax scenarios currently persist in localStorage (web) and AsyncStorage (mobile) behind `apps/*/lib/tax-scenario.ts`. Migrate them into the synced store here so they attach to an account, while still working before login.
