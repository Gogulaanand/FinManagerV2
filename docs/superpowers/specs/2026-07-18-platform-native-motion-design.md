# Platform-native motion and navigation design

## Scope

Extend the current Phase 5.2 UI fixes with:

- Capitalized user-facing labels for cash-flow event types while keeping enum values unchanged.
- A sticky desktop sidebar that remains available while the main pane scrolls.
- A restrained motion layer for web and mobile: loading skeletons at real data boundaries, entrance reveals, light stagger, progress transitions, and amount transitions.

## Motion principles

Motion is purposeful and finite. It communicates loading, hierarchy, and state change; it does not continuously animate or delay user input. All effects use short durations, transform/opacity where possible, and respect `prefers-reduced-motion` on web and the platform reduced-motion setting on mobile. Empty data states remain distinct from loading states.

## Web architecture

Use GSAP with `@gsap/react` and `useGSAP()` for client-only setup and cleanup. A page motion wrapper scopes one entrance timeline to the main content, while cards and marked sections reveal with a small stagger. `Amount` owns a cancellable count-up transition for displayed values. Loading skeletons render only while PowerSync query data is initially unavailable. The desktop sidebar uses `position: sticky`, `top: 0`, viewport height, and its own overflow so it remains usable independently of the center pane.

## Mobile architecture

Use the already-installed `react-native-reanimated` package for native transitions. Reusable animated wrappers handle card/page entrance and progress fills; the amount component animates its numeric shared value and updates display text on the JS boundary. The system reduced-motion setting skips or shortens motion. No web animation dependency is added to the mobile bundle.

## Data and labels

Expose `loading` from the Expenses and Portfolio hooks using the initial query data state. Capitalize event labels only at the presentation boundary (`Buy`, `Sell`, `Dividend`, etc.); persistence continues to use the existing lowercase enum values.

## Verification

- Add a focused core test for event-label formatting if the shared formatter is extracted.
- Run web/mobile lint and typecheck, core tests, repository tests, and production build.
- Perform route smoke checks and inspect the final worktree.
- Stop before commit for the user’s manual web/mobile QA and motion judgment.
