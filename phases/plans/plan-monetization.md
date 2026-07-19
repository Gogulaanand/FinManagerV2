# Plan: Monetization - Honest Assessment and Staged Recommendation

Status: assessment + recommendation; Path A is implementable, Path B is an architecture sketch behind an explicit trigger.
Mandate from the owner: assess honestly whether the app can carry a subscription, then recommend a path with full reasoning.

## Cross-doc dependencies

| Dependency                                      | Produced by            | Consumed by                      |
| ----------------------------------------------- | ---------------------- | -------------------------------- |
| Working signup email (D-024)                    | Phase 8a / verified 9b | Any external user, free or paid  |
| Deployed web + native mobile build              | Phase 9b / 9c          | Any external user                |
| Persistent encrypted mobile storage             | Phase 9c               | Credibility of the privacy pitch |
| Atomic `ai_usage` RPC (improvements I1 item #1) | plan-improvements.md   | Path B per-plan AI budgets       |
| Real settings page (web)                        | Phase 8b               | The "Support" surface            |
| DPDP-compliant privacy policy                   | Write during 9d        | Any external user                |

---

## 1. The honest assessment

### Who would actually pay

The plausible paying audience is narrow: privacy-first Indian DIY-finance users who explicitly do not want Account-Aggregator apps holding their data, plus FIRE-community users who want tax + expenses + portfolio + goal math unified in one place.
This audience is real (r/FIREIndia, FIRE Discord/Telegram groups, privacy-minded HN/Reddit readers) but small, and reaching it costs marketing effort nobody has signed up for.

### The moat, candidly

Genuine differentiators:

- Privacy and offline-first as architecture, not marketing: local SQLite, no third-party analytics, no server-side financial reads outside the sanctioned AI digest path (D-043).
- The dead-man switch: genuinely rare in consumer finance apps, emotionally resonant, and hard for AA-based incumbents to copy credibly (their pitch is data access, ours is data custody).
- Unified India-specific engine: statute-sourced tax rules under the Income-tax Act 2025 (D-018/D-019), XIRR on actual cash flows, RSU/FX handling, FIRE variants - depth that free calculators and trackers each cover only a slice of.
- Owner-controlled AI with a token budget rather than a data-mining "insights" funnel.

The honest weaknesses:

- ET Money, INDmoney, and Kuvera auto-fetch portfolios and transactions via Account Aggregator for free; FinManager asks for manual entry.
  For most consumers convenience beats privacy, and no pricing model changes that.
- Manual-entry apps live or die on habit; churn among casual users will be high.
- Single-maintainer, LLM-agent-built, no support organization: a paying customer is entitled to expectations the project is not staffed to meet.
- The tax engine currently ships one FY; a paid product creates a hard annual maintenance obligation the day the Finance Bill passes.

### Hard blockers before ANY external user (free or paid)

- Signup email is broken (D-024); fixed in Phase 8a, verified in 9b.
- Mobile local data is in-memory SQL.js (D-021); fixed in 9c.
- The web app is not deployed anywhere; 9b.
- No privacy policy; DPDP Act 2023 obligations (notice, consent, erasure on request, breach notification) apply the moment a non-family user's personal data is processed.
- Free-tier ceilings: Supabase (500MB DB, 500K Edge Function invocations/mo), PowerSync free tier, Resend free tier (100 emails/day).
  Family scale never touches these; even modest external adoption will, and the packages/sync abstraction plus the documented custom-sync fallback is the pressure valve.

### Why would people pay - the honest answer

A small number of people would pay for custody + the dead-man switch + the unified India engine.
Most people would not, because the free incumbents are more convenient.
The realistic framing: FinManager is a superb personal/family tool whose paid market is unproven, and proving it requires distribution work that is a bigger commitment than any billing code.
Monetization should therefore never be the reason to build features; at most it can recover costs and signal demand.

## 2. Recommendation

**Staged: ship Path A (donations) after Phase 9. Do not build subscriptions now. Revisit Path B only when a trigger fires: roughly 50+ external monthly-active users, or repeated unsolicited willingness-to-pay signals.**

Reasoning: entitlement and payment code is pure liability at zero external users - it must be maintained, secured, and complied with while gating nobody.
Donations cost one session, zero architecture, and produce the same demand signal a paywall would, without the support obligations.
The trigger is deliberately concrete so the decision is not re-litigated every month.

### Concept: monetization models and what they cost you

A donation is a gift: no entitlement, no recurring obligation, no refunds surface, no store-billing implications if nothing is unlocked.
A subscription is a contract: entitlement state, payment lifecycle (create, renew, fail, grace, cancel), refund policy, tax invoicing, and - if sold inside a store-distributed app - mandatory store billing at a 15-30% cut.
The gap between them is roughly 10x in code and 100x in obligation, which is why the staged path starts with the gift.

---

## 3. Path A - donations (implementable, 1 session, after Phase 9)

### Design

- Primary: a Razorpay Payment Link / payment page (UPI-native, cards, netbanking; one-time amounts with presets).
  Razorpay requires KYC (PAN, bank account); if that friction is unwanted, fall back to Buy Me a Coffee (simpler, but card-centric and takes a percentage; UPI support is weaker).
- Strictly a tip: nothing is unlocked, no perks, no recurring mandate.
  Because nothing is unlocked and distribution is EAS-internal (see plan-phase9 9d), Play/App Store billing rules are never triggered.
- No entitlement code, no webhook, no plan column, no server changes.

### UX (non-cheapening, matches the product's quiet register)

- A "Support FinManager" row in Settings on both platforms (web settings page exists after Phase 8b) that opens the payment link in the external browser; one line of copy about server and AI costs.
- One dismissible dashboard card, shown at most once after roughly 30 days of active use (tracked in a synced profile field or local flag), dismiss-forever.
- Nothing else: no interstitials, no badges, no reminders.
  The donation surface must never make the app feel free-tier-crippled, because the privacy pitch depends on the app feeling owner-aligned.

### Files (when executed)

- `apps/web/src/app/settings/page.tsx` and `apps/mobile/app/(tabs)/settings.tsx`: Support row.
- Dashboard card component per platform + the shown/dismissed flag.
- No backend changes.

Exit criteria: link works from both platforms; card shows once and stays dismissed across devices; zero gating anywhere.

---

## 4. Path B - subscriptions (architecture sketch only; build only on trigger)

### Entitlement model

- New `entitlements` table: `user_id, plan (free|supporter|family), status (active|grace|lapsed), provider, provider_ref, current_period_end, grace_until`, server-written only (service role), RLS SELECT-own, synced read-only via PowerSync so gating works offline.
- Deliberately not a `profiles.plan` column: payment state needs an auditable, server-owned row that clients can read but never write, and history/provider references do not belong on the profile.
- Client gating reads the synced row; offline lapse tolerance comes from `grace_until`.

### Payments (India-first)

- Razorpay Subscriptions with UPI Autopay for web-sold plans.
  RBI recurring-payment rules (e-mandate with additional-factor authentication at setup, auto-debit limits) are handled by the provider; pricing should sit comfortably under the auto-debit ceiling, e.g. ₹99/mo or ₹999/yr.
- Webhook Edge Function `razorpay-webhook`: signature verification against the webhook secret, idempotent event handling, writes `entitlements`; mirrors the `deadman-check` service-role pattern.
- Store billing caveat: if the app is ever listed on Play/App Store, digital subscriptions sold in-app must use store billing (15-30% cut) - EAS internal distribution (the 9d decision) deliberately avoids this; selling on the web and reading entitlement in the app is the escape most stores now tolerate only under specific programs, so re-verify policy if store listing ever happens.

### What paid gets (and what it never gates)

- Paid levers: a larger AI token allowance (make `ai-insights` read a per-plan budget from `entitlements` instead of the global `INSIGHTS_MONTHLY_TOKEN_BUDGET` env; requires the atomic `ai_usage` RPC from improvements I1 first, since concurrent streams currently race the budget check), and family/multi-profile features when they exist.
- The free tier keeps everything current users have, with a modest AI budget.
- The dead-man switch stays free forever: paywalling a safety feature is ethically wrong and would be reputationally fatal for a privacy-positioned app.
  Lapse behavior is downgrade-not-lockout: data is never held hostage, export always works.

### Estimated cost

3-4 agent sessions (entitlements + webhook + gating + upgrade UX) plus non-code work: refund policy, invoicing/GST question (Razorpay can invoice, but GST registration thresholds need a real accountant's answer), DPDP privacy policy update, support channel.
This estimate is itself an argument for the staged recommendation.

---

## 5. Decision log entry to append when this plan is adopted

Record in DECISIONS.md: staged monetization adopted; donations after Phase 9; subscription trigger defined (≈50 external MAU or repeated willingness-to-pay); dead-man switch permanently free; internal distribution retained partly to avoid store billing.
