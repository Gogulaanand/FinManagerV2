# Private beta rollout

This document records the approved lean private-beta commercialization boundary for FinManagerV2.
It is intentionally small: the Supabase dashboard is the only admin surface, there is no billing,
subscription, paywall, CRM, analytics stack, pricing, or automated invitation system, and every
approved beta user has the full current product.

## Repository implementation

Migration supabase/migrations/20260815000001_private_beta_access.sql adds the private
public.beta_access table with:

- normalized lowercase email as the primary key;
- nullable unique user_id linked to auth.users;
- status: requested, approved, or revoked;
- access_kind: beta or complimentary;
- requested_at and nullable reviewed_at.

The table has no Data API access for anon or authenticated. The only anonymous database operation is
public.request_beta_access(text), which validates and normalizes the email, creates or refreshes
only requested/beta rows, preserves approved or complimentary rows, and returns the same generic
result regardless of allowlist state.

public.hook_before_user_created(jsonb) is the Postgres function for Supabase Auth's Before User
Created hook. It allows only approved rows and returns the same friendly private-beta rejection for
requested, revoked, and unlisted emails. The migration does not enable the hook. The existing
post-create provisioning function links an approved auth user to its beta_access row before
creating the existing profile and default categories.

There are no current entitlement checks. If paid access is added later, the future invariant is
complimentary OR active paid entitlement; it is not part of this beta implementation.

## Owner rollout sequence

1. Apply the repository migration to the intended Supabase project. Do not enable the Auth Hook
   yet. The migration is designed to be deployed safely before the hook is active.

2. In the Supabase SQL Editor, seed the owner and every existing account. Replace the placeholders
   in the editor only; do not commit real addresses into the repository:

       insert into public.beta_access (email, status, access_kind, reviewed_at)
       values (lower(btrim('<OWNER_EMAIL>')), 'approved', 'complimentary', now())
       on conflict (email) do update
       set status = 'approved',
           access_kind = 'complimentary',
           reviewed_at = now();

   Repeat the statement for each friend/family account that should receive complimentary access.
   Use access_kind = 'beta' for a manually approved non-family beta account.

3. Link rows to existing Auth users and verify the seed. This does not create or delete users:

       update public.beta_access b
       set user_id = u.id
       from auth.users u
       where lower(btrim(u.email)) = b.email
         and b.status = 'approved'
         and b.user_id is null;

       select email, status, access_kind, user_id is not null as linked
       from public.beta_access
       order by email;

4. Enable the hook in Supabase: Authentication → Hooks → Before User Created → Postgres
   function → public.hook_before_user_created. Keep the hook disabled until the approved
   owner/existing-account rows are present and the link query has been reviewed.

5. Test one existing password sign-in, one approved new email/password signup, and one approved
   Google signup. Test an unlisted email and confirm the friendly private-beta message. The web
   request form should return only its generic success message; approval remains a manual
   dashboard action.

6. To approve a pending request, update it in the dashboard SQL Editor:

       update public.beta_access
       set status = 'approved',
           access_kind = 'beta',
           reviewed_at = now()
       where email = lower(btrim('<REQUEST_EMAIL>'));

   To revoke access, mark the row revoked, then ban the matching Auth user in Authentication →
   Users. Do not delete the row or the user's product data:

       update public.beta_access
       set status = 'revoked',
           reviewed_at = now()
       where email = lower(btrim('<REQUEST_EMAIL>'));

7. As the retention maintenance action, manually remove only unapproved requests older than
   90 days:

       delete from public.beta_access
       where status = 'requested'
         and requested_at < now() - interval '90 days';

## Hosted rollout record

On 2026-08-15, the migration was applied to the authenticated `finmanager` Supabase project.
The five existing Auth users were backfilled as approved + complimentary and linked to their
`beta_access` rows. The Supabase Before User Created hook was then enabled for
`public.hook_before_user_created`.

The hosted read-only contract check passed: approved access allows signup, unlisted access is
rejected with HTTP 403, `anon` can execute only the request RPC, and anonymous table and hook
access remain blocked. No additional friends/family addresses were invented or added; add those
manually through step 2 when their addresses are available. Deployment, commit, push, and PR
publication remain outside this rollout.
