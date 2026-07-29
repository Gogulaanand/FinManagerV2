# Phase 8.5 Briefing: Design Alignment

Status: implementation, local automated verification, seeded web E2E, and compact/large simulator
evidence complete; real-touch native evidence remains pending.

## Purpose

Phase 8.5 aligns web and mobile with the existing Stitch project before Phase 9 resumes. It keeps
the Calm Teal application tokens authoritative, preserves real-data and offline-first behavior, and
does not change any backend, delivery, routing, sync, or AI contract.

## Selected Stitch concepts

Project `15700405983783543744` uses design system `10681403320511857968` (FinManager Calm Teal).
The selected variants balance functional completeness, accessible contrast and labels,
cross-platform feasibility, and consistency with existing tokens.

| Surface                        | Mobile screen                      | Desktop screen                     | Selection notes                                                                                                                |
| ------------------------------ | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard and asset allocation | `038de751cb4d48e6adbcf5a62996c030` | `17eb917b8edc46a8b10ed0939ada6f22` | Accessible mobile hierarchy and a denser desktop information grid; both keep real values and honest empty states.              |
| Expense analytics              | `822239a09c8e41dbb0f252bcfeca17bd` | `9682398b1cb443fbb4c8cd86e13677a6` | Text legends, category badges, readable axes, and budget state labels remain visible beside the charts.                        |
| AI Insights                    | `dcedbe68f0ce4f03b63f5b76ae37a576` | `ef511e34e4d745a49c61678d263205d7` | Compact mobile composer with streaming stop state; desktop separates saved health, scope, prompts, and ephemeral conversation. |
| Dead-man safety                | `40555b718ee040e289ef43a5c25f2a69` | `c3a34aea960e4197a6d847abf07d291b` | Safety status leads, followed by a comprehensible four-stage timeline, scoped contacts, local preview, and event history.      |

Literal Stitch typography, spacing, or colors do not override the app system. Manrope remains the
display and amount face, Inter remains body text, cards keep the 12px rhythm, gain remains the
accessible `#047857`, and all surfaces continue to support light and dark modes.

## Implementation

- Shared category presentation resolves the existing 21 default icon/color pairs and gives new
  custom categories the semantic `tag` icon with brand teal `#0F766E`. Null or unknown legacy
  values render through the same fallback without a database backfill. The shared repository guard
  also covers future template-import category creation when Phase 9 is rebased.
- Lucide and Ionicons render the same persisted category keys on web and mobile. Category badges now
  appear in dashboard and expense transactions, category management, budgets, chart legends, and
  portfolio asset-class summaries.
- Both dashboard adapters expose the existing portfolio allocation rows. Responsive donut cards
  use deterministic asset-class colors/icons, INR values, percentages, and a truthful no-valued-
  holdings state; no sample financial values are rendered.
- Expense charts now share Indian currency/percentage formatting, textual legends and summaries,
  income/spend inspection, category amount/share details, and overspend/near-limit states. Web uses
  hover/focus tooltips; mobile uses Victory press state and an on-screen selected-value summary.
- AI Insights now presents saved monthly health, icon scopes, suggested prompts, an ephemeral
  conversation, and a sticky/keyboard-safe composer. Offline, allowance, streaming/cancel, and
  generic error states remain distinct while preserving the Anthropic SSE contract and cost gate.
- Dead-man settings now lead with enabled/disabled safety status, the exact threshold +0/+7/+14/+21
  sequence, disclosure-scope cues, trusted-contact cards, draft-local preview, test-send, and
  readable history. Settings hydration, activity semantics, Edge Function calls, and delivery logic
  are unchanged.
- The icon audit also covers portfolio, goals/FIRE, tax, settings, KPI labels, section headings, and
  common actions. Existing navigation icons remain; no new bespoke brand mark was introduced.

## Automated evidence

- Category/default/fallback, analytics propagation, recent activity, new-category persistence, and
  deterministic allocation presentation have focused Vitest coverage.
- The Phase 8.5 Playwright suite contains five cost-free scenarios covering seeded dashboard
  allocation/category badges, chart legends and inspection text, custom/imported fallback badges,
  mocked Insights offline/allowance/error states, and local dead-man preview without email.
- The dedicated account was created and reset through the idempotent server-only fixture script.
  `CI=true pnpm --filter @finmanager/web e2e` passed all five Chromium scenarios in 18.8 seconds.
  The Supabase admin key and generated account password remained subprocess-only and were neither
  persisted nor printed. The first run caught and fixed an ambiguous preview-text selector; the
  rerun passed without an Anthropic request or email delivery.
- `CI=true pnpm --filter @finmanager/web exec playwright test --list` collects all five tests.
- `CI=true pnpm turbo run build test lint typecheck`: 21/21 tasks passed. The unit suites contain
  317 passing tests (tokens 27, schema 42, core 199, sync 49).
- `CI=true pnpm format:check` and `git diff --check` pass.
- `CI=true pnpm --filter @finmanager/web exec playwright test --list` collects all five Phase 8.5
  E2E tests.
- `CI=true ../../node_modules/.bin/expo export --platform ios` completed: Metro bundled 2,639
  modules into a 13 MB Hermes bundle.
- Local Chrome verified Dashboard, Insights, and Expenses in light/dark desktop and at a 390px
  viewport: meaningful content, no Next overlay, no console errors, and no horizontal overflow.
  The visual pass caught and fixed an all-zero trend chart that had rendered a misleading ₹0–₹4
  axis; both clients now show the transaction empty state.
- Expo Go on an iPhone 17 Pro simulator opened an existing authenticated, data-filled session.
  Dashboard allocation and expense analytics rendered real synced values; the native audit moved
  analytics ahead of the long transaction list and fixed chart content-width clipping so the full
  six-month axis remains visible. Insights kept its focused composer above the software keyboard.
  Dead-man settings rendered the hydrated safety status, escalation sequence, disclosure note,
  local Save/Preview controls, and both scoped trusted-contact cards. No Test-send action was used.
- An iPad Pro 13-inch simulator verified the large native layout in light and dark modes. Dashboard
  preserved truthful empty allocation/activity states; Expenses placed all three analytics cards
  before transactions without clipping or horizontal overflow; Insights retained its scope grid,
  explicit offline state, conversation workspace, and sticky composer; signed-out Settings retained
  readable appearance/account controls. Dark primary actions use the intentional AA-tested
  `#2DD4BF`/`#04211E` token pair.

## Pending evidence

- Real-touch/device checks remain. Victory's chart press state could not be activated with
  Simulator mouse events, so tap selection and gesture behavior are not claimed. The Expo Go runs
  are not custom-build or physical-device proof.
- Signed-out light/dark and compact web screenshots were compared with the selected hierarchy and
  are aligned. Authenticated, data-filled behavior is covered by the passing seeded E2E suite.
  Expo export and local CI are not substitutes for real-device proof.

Phase 9 remains paused in its separate checkout. After this branch lands on `main`, that branch must
be rebased separately so its template-import and hardening work picks up the shared repository
fallback and design system changes.
