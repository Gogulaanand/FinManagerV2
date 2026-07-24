# Phase 8 External Verification Runbook

This runbook completes the external deployment and verification gates for:

phases/plans/plan-phase8-deadman-switch.md

Do not commit the Phase 8 changes until every required check below is complete and the owner explicitly approves the diff.

## Current project details

- Repository: /Users/gogulaanand/Documents/Projects/FinManagerV2
- Supabase project ref: vkivzhbckfsjtvzatuiz
- Supabase URL: https://vkivzhbckfsjtvzatuiz.supabase.co
- Migration: supabase/migrations/20260723021348_phase8_deadman.sql
- Edge Function: deadman-check
- PowerSync rules: supabase/powersync/sync-rules.yaml
- Web app: http://localhost:3000
- Existing staged user ID: f2014cd9-7e2b-46aa-9555-a701c7aad0a5
- Existing staged email: gogulaanand02+webtest@gmail.com

Already deployed or verified:

- Phase 8 migration is applied remotely.
- deadman-check is active remotely.
- Vault-backed cron secrets exist.
- deadman-daily is active at 0 3 * * *.
- Supabase has the powersync_role role and powersync publication.
- A live cron request can create a cancelled event after fresh activity.

Remaining gates are PowerSync rule publication, verified email delivery, Auth SMTP, the full authenticated simulation, browser verification, and native mobile verification.

## 1. Publish PowerSync rules

The database-side PowerSync replication role and publication already exist. Do not rerun supabase/powersync/setup.sql unless the PowerSync dashboard reports that the database connection is missing.

1. Open https://dashboard.powersync.com/.
2. Select the FinManager project and the instance whose URL is:
   https://6a5b0b247f33bac37ef7cefc.powersync.journeyapps.com
3. Open Sync Streams. If the instance uses the legacy interface, open Sync Rules instead.
4. Replace the editor contents with the complete contents of supabase/powersync/sync-rules.yaml.
5. Click Validate.
6. Resolve every validation error. These Phase 8 tables must validate:
   - deadman_settings
   - escalation_events
   - trusted_contacts
   - activity_log
7. Click Deploy.
8. Open Health or Deploy Logs and wait for a successful deployment.
9. Open Sync Test and generate a development test token for:
   f2014cd9-7e2b-46aa-9555-a701c7aad0a5
10. Confirm that the diagnostics client receives the user’s deadman_settings, trusted_contacts, and escalation_events rows.

PowerSync documents the edit → validate → deploy flow at:
https://docs.powersync.com/tools/powersync-dashboard

## 2. Verify a Resend sending domain

The current onboarding@resend.dev sender cannot deliver to the staged Supabase user. A domain owned by the project owner is required.

1. Open https://resend.com/domains.
2. Click Add Domain.
3. Add the root domain or a dedicated transactional subdomain. A subdomain such as mail.example.com is recommended.
4. Copy the DNS records shown by Resend.
5. Add those records at the DNS provider that controls the domain’s nameservers:
   - SPF
   - DKIM
   - Any MX/return-path record requested by Resend
6. Return to Resend and click Verify DNS Records.
7. Wait until the domain status is Verified.
8. Choose a sender address on that exact verified domain, for example:
   FinManager <deadman@mail.example.com>

Resend domain documentation:
https://resend.com/docs/dashboard/domains/introduction

Optional DNS checks:

```
nslookup -type=TXT resend._domainkey.mail.example.com
nslookup -type=TXT send.mail.example.com
nslookup -type=MX send.mail.example.com
```

## 3. Rotate and configure the Resend key

Never place an API key in this repository, this runbook, shell history, or chat.

If the previously created key was exposed, revoke it in Resend and create a new sending-only key.

Enter the key without echoing it:

```
cd /Users/gogulaanand/Documents/Projects/FinManagerV2
read -s RESEND_API_KEY
export RESEND_API_KEY
```

Set the Edge Function secrets:

```
supabase secrets set \
  --project-ref vkivzhbckfsjtvzatuiz \
  RESEND_API_KEY="$RESEND_API_KEY" \
  RESEND_FROM_EMAIL="FinManager <deadman@mail.example.com>"
```

The deployed function reads these values at runtime. No source-code change or redeploy is needed solely for a secret update.

## 4. Configure Supabase Auth SMTP

Open:

Supabase Dashboard → project vkivzhbckfsjtvzatuiz → Authentication → Email → SMTP Settings

Enter:

| Field        | Value                      |
| ------------ | -------------------------- |
| SMTP host    | smtp.resend.com            |
| SMTP port    | 465                        |
| Username     | resend                     |
| Password     | The current Resend API key |
| Sender email | auth@mail.example.com      |
| Sender name  | FinManager                 |

The sender must use the verified Resend domain. Enable custom SMTP and save.

Resend SMTP documentation:
https://resend.com/docs/send-with-smtp

Supabase Auth SMTP documentation:
https://supabase.com/docs/guides/auth/auth-smtp

Also check Authentication → URL Configuration and ensure this local redirect URL is present:

```
http://localhost:3000/**
```

Keep the production redirect URL configured as well.

## 5. Start and verify the web app

From the repository root:

```
cd /Users/gogulaanand/Documents/Projects/FinManagerV2
pnpm web
```

Open http://localhost:3000/settings and sign in as gogulaanand02+webtest@gmail.com.

Verify:

- The dead-man switch can be enabled and disabled.
- Threshold can be set to 1 day for staging.
- Disclosure note saves and reloads.
- Trusted contacts can be added, edited, and deactivated.
- existence and summary disclosure scopes save.
- Preview renders the intended notice.
- Test-send reaches the signed-in user.
- Escalation history renders event rows.
- Reloading or revisiting the app records fresh activity.

## 6. Obtain a test access token without exposing it

The simulate action is an authenticated Edge Function action. Use the staged account password; do not put it in shell history.

```
export SUPABASE_URL="https://vkivzhbckfsjtvzatuiz.supabase.co"
export SUPABASE_ANON_KEY="<copy the project publishable anon key>"
export TEST_EMAIL="gogulaanand02+webtest@gmail.com"
read -s TEST_PASSWORD
export TEST_PASSWORD
```

Request a session:

```
AUTH_JSON="$(
  curl --fail-with-body --silent --show-error \
    "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "content-type: application/json" \
    --data "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
)"
```

Extract the token without printing it:

```
export ACCESS_TOKEN="$(printf '%s' "$AUTH_JSON" | jq -r '.access_token')"
test -n "$ACCESS_TOKEN" && test "$ACCESS_TOKEN" != "null"
```

If the password is unavailable, do not reset or change the existing test account without owner approval. Use the normal web sign-in flow instead.

## 7. Run the full authenticated simulation

With the staged threshold set to one day, the values are T=1, T+7=8, T+14=15, and T+21=22.

```
for DAYS in 1 8 15 22; do
  curl --fail-with-body --silent --show-error \
    "$SUPABASE_URL/functions/v1/deadman-check" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "content-type: application/json" \
    --data "{\"action\":\"simulate\",\"simulateInactiveDays\":$DAYS}"
  printf '\n'
done
```

Expected sequence:

| Simulated inactive days | Expected event                            |
| ----------------------: | ----------------------------------------- |
|                       1 | reminder_1 to the user                    |
|                       8 | reminder_2 to the user                    |
|                      15 | reminder_3 to the user                    |
|                      22 | disclosure to each active trusted contact |

Repeat the final stage for idempotency:

```
curl --fail-with-body --silent --show-error \
  "$SUPABASE_URL/functions/v1/deadman-check" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "content-type: application/json" \
  --data '{"action":"simulate","simulateInactiveDays":22}'
```

The repeat must not create another successful or pending event for the same stage and recipient.

## 8. Verify the event ledger

Run this in Supabase Dashboard → SQL Editor:

```
select
  kind,
  status,
  recipient,
  detail,
  created_at,
  sent_at
from public.escalation_events
where user_id = 'f2014cd9-7e2b-46aa-9555-a701c7aad0a5'
order by created_at asc;
```

Confirm:

- One successful reminder_1.
- One successful reminder_2.
- One successful reminder_3.
- One successful disclosure per active contact.
- No duplicate successful rows after the repeated simulation.
- Simulation events contain detail.simulation.
- Failed rows, if any, contain a useful delivery error.

## 9. Verify cancellation through a real app open

1. Leave the app signed in.
2. Navigate away from Settings and return, or reload the app.
3. Wait for the fresh activity_log row to synchronize.
4. Set the cron secret without echoing it:

```
read -s CRON_SECRET
export CRON_SECRET
```

5. Trigger deployed cron mode:

```
curl --fail-with-body --silent --show-error \
  -X POST \
  "$SUPABASE_URL/functions/v1/deadman-check" \
  -H "content-type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  --data '{"mode":"cron"}'
```

6. Query the newest events:

```
select kind, status, detail, created_at
from public.escalation_events
where user_id = 'f2014cd9-7e2b-46aa-9555-a701c7aad0a5'
order by created_at desc
limit 10;
```

Expected cancellation:

```
kind   = cancelled
status = sent
detail = {"reason":"app_open"}
```

## 10. Verify Auth signup delivery

1. Sign out of the web app.
2. Sign up with a new email address that you control.
3. Confirm that the message arrives from the verified Auth sender.
4. Click the confirmation link.
5. Sign in with the new account.
6. Check the Resend email log for the message.
7. Confirm the user in Supabase SQL Editor:

```
select email, email_confirmed_at
from auth.users
where email = 'your-test-address@example.com';
```

email_confirmed_at must be non-null.

## 11. Verify the mobile UI

Start Expo:

```
cd /Users/gogulaanand/Documents/Projects/FinManagerV2
pnpm mobile
```

Open the app in Expo Go or an available native simulator/device.

Verify:

- Dead-man settings appear in Settings.
- Enable/disable persists.
- Threshold and disclosure note persist.
- Add/edit trusted-contact modal routes work.
- Disclosure scope and active toggle persist.
- Preview works.
- Test-send works.
- Escalation history renders.
- Returning to the foreground records activity.
- Offline edits appear immediately and synchronize after reconnect.

If no native simulator or device is available, record native verification as pending. Expo web export is not native verification.

## 12. Final verification gate

After all external checks pass, run:

```
cd /Users/gogulaanand/Documents/Projects/FinManagerV2
CI=true pnpm turbo run build test lint typecheck
pnpm format:check
git diff --check
git status --short
```

Do not run git commit.

Record the following evidence for the owner:

- PowerSync deployment result.
- Verified Resend domain and sender.
- Auth SMTP save/test result.
- T/T+7/T+14/T+21 event rows.
- Idempotency result.
- Cancellation result.
- Signup confirmation result.
- Chrome verification result.
- Native mobile verification result.

Only after owner review and explicit approval may the Phase 8 changes be committed.
