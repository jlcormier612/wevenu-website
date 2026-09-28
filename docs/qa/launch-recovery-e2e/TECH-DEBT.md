# Launch Recovery — deferred technical debt

Items found during the 2026-09-28 launch-recovery journey run that are real but
are **not** on the critical path. None of these caused a customer-facing failure
during the journeys. Deferred deliberately so the recovery run was not derailed.

## P2 — Legal service auth.users lookup does not scale

`lib/legal/service.ts` → `findAuthUserIdByEmail()`

Performs an invalid PostgREST `auth.users` lookup and falls back to `listUsers`
capped at 2000 users; current 46-user environment works but the architecture does
not scale beyond that limit.

Detail:

- The "preferred" path is `admin.schema("auth").from("users")`. PostgREST does not
  expose the `auth` schema, so this fails on **every** call with
  `PGRST106: Invalid schema: auth`. Confirmed in the Sandbox ECS logs:
  `[legal] auth.users email lookup failed; falling back to listUsers`.
- The fallback pages `admin.auth.admin.listUsers({ perPage: 200 })` for at most 10
  pages. Past 2000 users the function returns `null` for a user that does exist,
  and the caller records no acceptance.
- Cost today is one wasted round trip plus one 200-row page per call, on a path
  that runs during login/legal enforcement.

Current environment has 46 auth users, so it is correct and cheap right now.

Decide during the final hardening pass whether this must be fixed before
production. The likely fix is a security-definer RPC for the email→id lookup
rather than either the PostgREST read or the Admin API scan.

## P3 — ALB access logs disabled

Sandbox ALB has access logging turned off, which is why the incident forensics had
to be reconstructed from Supabase's privileged Prometheus endpoint and ECS logs
rather than from request-level data. Enable before production so a future incident
can be attributed to specific routes and clients.

## P2 — One other Server Action still redirects into the gated workspace

`app/admin/onboarding/actions.ts` → `startOperatorConfigureAction()` redirects to
`/setup-hub` after starting an HQ operator venue session. `/setup-hub` lives inside
the `(app)` tree, whose layout can redirect again (to `/onboarding/ownership`, or
`/billing/suspended`). That is the same collision that left first-time venue login
on a permanently blank page.

Not fixed during the recovery run because it is an HQ White-Glove operator path,
not one of the customer journeys under test, and it only collides in the ownership
case. The fix is the same shape as the login one: hand the destination to the
client and navigate, rather than redirecting from inside the action.
