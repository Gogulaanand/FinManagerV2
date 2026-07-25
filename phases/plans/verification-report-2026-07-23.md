# Plan vs Implementation Verification Report (2026-07-23)

Scope: plan-improvements.md, plan-mobile-nav-and-month-picker.md, plan-phase8-deadman-switch.md.
Method: each plan item checked against committed code (120d778, fba717e) or the uncommitted working tree for Phase 8.

## Overall verdict

- plan-improvements.md: fully implemented. Two items resolved differently than written, both defensible and documented.
- plan-mobile-nav-and-month-picker.md: fully implemented. No functional gaps.
- plan-phase8-deadman-switch.md: code findings F1, F3, F5, and F6 are resolved; external findings F2 and F4 remain pending until provider configuration and interactive verification are completed.

## Audit remediation status

- F1 resolved: the web preview now constructs a real newline-delimited string instead of rendering literal backslash-n characters.
- F2 pending: Resend domain verification, Auth SMTP, and successful delivery still require owner/provider configuration.
- F3 resolved: Vault prerequisites and the schedule invariant are recorded in D-054; the linked project has both Vault secrets and an active `deadman-daily` job.
- F4 pending: PowerSync publication, authenticated simulation transcript, idempotency, email receipt, and web/native interactive evidence remain external gates.
- F5 resolved: stage selection, inactivity calculation, and current-event retry/idempotency logic are extracted into `supabase/functions/deadman-check/logic.ts` with focused Vitest coverage.
- F6 resolved: D-052 now explicitly supersedes the historical deletion assumption in D-042 while retaining the referenced contextual forms.

## Findings

### F1 (bug, Phase 8, web): preview renders literal `\n\n`

`apps/web/src/components/settings/deadman-settings.tsx:135` has `{item.recipient} · {item.scope}\n\n{item.text}` in JSX.
Those backslash-n characters are literal text, not newlines, so the email preview shows `\n\n` on screen.
Mobile builds the string in a template literal and is correct.

Guidance: build the string in JS, e.g. `{`${item.recipient} · ${item.scope}\n\n${item.text}`}` inside the `<pre>`.

### F2 (gap, Phase 8): external delivery setup not done

Per phases/briefing/phase-8.md, the live cron ran but reminder emails failed because Resend has no verified sending domain.

Guidance, in order:

1. Verify a sending domain in Resend and set `RESEND_API_KEY` / `RESEND_FROM_EMAIL` function secrets.
2. Point Supabase Auth SMTP at Resend and prove one real signup email (D-024).
3. Re-run the staged escalation and confirm receipt.

### F3 (setup dependency, Phase 8): cron job creation is gated on Vault secrets

The migration deviates from the plan: instead of `CRON_SECRET`, it reads `deadman_supabase_url` and `deadman_cron_secret` from Supabase Vault, and silently skips `cron.schedule` if they are absent.
This is a reasonable improvement, but a fresh environment gets no cron job with no error.

Guidance: confirm the two Vault secrets exist in the live project and that `cron.job` contains `deadman-daily`.
Document the Vault prerequisite in the briefing and DECISIONS.md.

### F4 (gap, Phase 8): verification steps from the plan not recorded

Outstanding: PowerSync sync-rules deployment, the authenticated `simulate` transcript at T / T+7 / T+14 / T+21 with idempotency proof, app-open `cancelled` re-confirmation after email works, and interactive UI checks on web and native.

Guidance: run these before marking Phase 8 Done, per the plan's own gate. Do not commit the phase as Done until F2-F4 close.

### F5 (test coverage, Phase 8): Edge Function logic untested

`supabase/functions/deadman-check/index.ts` holds the escalation derivation and idempotency logic, but no automated test covers it.
Existing tests (schema, sync repo, activity retry) are real but thin.

Guidance: extract the pure derivation (stage selection, hasCurrentEvent, retry window) into a testable module and add a Vitest suite, or at minimum record the manual simulate transcript as evidence.

### F6 (documentation, improvements plan): D-042 not formally superseded

Plan item I3#11 assumed the D-042 components were dead and should be deleted with D-042 superseded.
The audit found `holding-event-form.tsx` and `valuation-form.tsx` still referenced by `holding-detail.tsx`, so nothing was deleted. D-052 records the audit but does not mark D-042 superseded.

Guidance: no code change needed. Add one line to D-052 (or D-042) clarifying the relationship so future readers do not re-attempt the deletion.

## Notes (no action)

- Improvements #1 used a reserve-then-settle pattern for AI usage metering instead of the plan's single check-and-increment, requiring a second migration. Documented in D-051/D-053; an enhancement, not a gap.
- Mobile-nav plan's two sub-phases shipped in one commit (fba717e) instead of independently; no explicit `Stack.Screen` registration was needed since the expo-router card default applies. Both acceptable per the plan's own wording.
