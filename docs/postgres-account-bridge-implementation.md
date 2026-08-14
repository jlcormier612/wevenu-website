# Postgres Account-Provisioning Bridge — Implementation Report

**Type:** Implementation, executed exactly per the approved plan in `docs/postgres-auth-architecture-findings.md` §6.
**Date:** 2026-08-14
**Scope:** Nothing outside the approved plan — `auth.uid()`, all 360 RLS policies, login, the broader `enqueueProductSync` pipeline, and White Glove were not touched. No commit, no push.

---

## What was built

**One migration** (`supabase/migrations/20261293000000_venue_enrollments.sql`):
- `public.venue_enrollments` — the real Postgres table replacing the local JSON file's role in this specific journey. Unique on `stripe_checkout_session_id`. RLS enabled, zero grants to `authenticated`/`anon` (service-role only, matching the pattern of every other internal-only table in this schema).
- `public.activate_venue_enrollment(token, owner_user_id)` — a `SECURITY DEFINER` Postgres function that atomically creates the `venues` row and marks the enrollment activated, with a row lock (`FOR UPDATE`) so two concurrent/retried calls can't double-create a venue.

**Two internal API endpoints** in the venue app, matching the existing `/api/internal/product-access/lock` pattern exactly (Bearer `PRODUCT_SYNC_API_KEY`, service-role, `runtime = "nodejs"`):
- `POST /api/internal/enrollment/upsert` — idempotent on `stripeCheckoutSessionId`.
- `POST /api/internal/enrollment/activate` — given `{token, password}`, reuses `resolveUserIdForEmail` (the same helper the existing legal-acceptance step already uses) to get-or-create the `auth.users` row, sets the real password via `admin.auth.admin.updateUserById`, then calls the atomic function above.

**One small shared client** (`shared/product-account/index.ts`) — two functions (`upsertVenueEnrollment`, `activateVenueAccount`) that `marketing/` and `workspace/` call over HTTP, reusing the already-documented `PRODUCT_API_BASE_URL`/`PRODUCT_SYNC_API_KEY` env vars (previously defined but never actually wired to anything real). Deliberately kept separate from `@shared/product-sync` — not an extension of that broader, still-stubbed pipeline.

**Two small edits to existing flow code:**
- `marketing/lib/crm/service.ts`'s `createVenueEnrollment` — added one call to `upsertVenueEnrollment`, passing the same activation token the existing local Relationship sync already generates (no change to token generation itself). The local Relationship record, dunning, health scoring, and Luv all continue exactly as before.
- `workspace/app/activate/actions.ts`'s `activateAccountAction` — replaced the simulated `recordOwnerActivationCredential` call with a real call to `activateVenueAccount`, and reordered so the real account is created *before* the local Relationship is marked activated (if the real step fails, nothing is left in a half-activated state).

**One necessary registration**, discovered only by testing, not anticipated in the plan: `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` needed `/api/internal/enrollment` added — without it, the proxy redirected unauthenticated requests (including legitimate Bearer-token calls) to `/login` before they ever reached the route handler. Same one-line shape as the existing `/api/internal/product-access` and `/api/internal/legal` entries.

---

## A real bug I found and fixed during my own testing

My first live test of retry-safety failed. The original function cleared `activation_token` to `null` on success — which meant a genuine retry (the same request sent twice because the caller never saw the first response) couldn't find the enrollment row anymore and got `invalid_or_expired_token` instead of the intended idempotent "already activated" result. Fixed by not nulling the token; `status = 'activated'` alone is what prevents any further effect, and is checked before any write happens. Re-tested and confirmed: first call activates for real, a second call with the identical token returns `alreadyActivated: true` with the same `venueId`, and only one venue row exists in the database. Recorded directly in the migration's comments so the reasoning isn't lost.

---

## Live verification performed (not just source review)

All against the real local database, using the real endpoints over HTTP, not mocks:

1. **Enrollment idempotency** — called `/upsert` twice with the same `stripeCheckoutSessionId`; confirmed exactly one row exists, same `id` returned both times.
2. **Activation, cold path** — called `/activate` with a fresh token and password; confirmed a real `venues` row and a real `auth.users` row were created, correctly linked (`venues.owner_user_id = auth.users.id`).
3. **Activation retry-safety** — called `/activate` twice with the same token; confirmed the second call returned `alreadyActivated: true` with the same `venueId`, and exactly one venue existed afterward (this is the case that caught the bug above).
4. **The realistic production sequence** — called the existing `/api/internal/legal/venue-activate` endpoint first (exactly as the real `activateAccountAction` does), confirmed it pre-creates a passwordless `auth.users` row, then called my `/activate` endpoint and confirmed it correctly reused that *same* user id (not a duplicate account) and set the real password on it.
5. **Real login** — for both scenario 2 and scenario 4, called Supabase's own `/auth/v1/token?grant_type=password` directly (the exact mechanism `app/auth/actions.ts`'s `signInWithPassword` uses) with the email and password set during activation. **A real access token was issued both times**, for the exact user id the venue's `owner_user_id` points at. This is the concrete proof the account is genuinely loggable-into, not just present in a table.
6. **Cleanup** — all test venues, enrollments, legal acceptances, and auth users created during this testing were deleted afterward; re-queried and confirmed zero residue.

---

## Tests

| Check | Result |
|---|---|
| `npx tsc --noEmit` (root) | Clean |
| `npx tsc --noEmit` (workspace) | Clean |
| `npx tsc --noEmit` (marketing) | Pre-existing, unrelated failure — three `Cannot find type definition file for 'node 2'/'react 2'/'react-dom 2'` errors caused by duplicate `@types/*` folders already present in `marketing/node_modules` before this session touched anything (confirmed by folder mtime, predates my changes). Not something this task should fix inside `node_modules`. Verified the specific edited file is sound instead: the marketing dev server (which does its own compilation) started and served successfully both before and after the edit, and the edit itself is a 15-line, reviewed addition with no new syntax. |
| `npm test` (root) | **587 / 587 pass**, unchanged from before this work — no regressions, no new unit tests added (this change is thin, integration-shaped infrastructure verified live per above, matching how the sibling `/api/internal/product-access/lock` and `/api/internal/legal/venue-activate` endpoints also have no dedicated unit test files) |

---

## The exact E2E path now supported

```
Stripe Checkout (marketing/, unchanged)
  → checkout.session.completed webhook (unchanged)
  → createVenueEnrollment()
       → local Relationship record + activation token (unchanged, still drives CRM/dunning/Luv)
       → NEW: real venue_enrollments row in Postgres, same token
       → welcome email with the activation link (unchanged, Resend, already correctly
         configured on hellotocheers.com per your prior request)
  → owner clicks the link → workspace/'s Activate Account form (unchanged UI)
  → activateAccountAction()
       → legal acceptance recorded (unchanged) — creates a passwordless auth.users row
       → NEW: real password set on that (or a newly created) auth.users row,
         real venues row created, atomically, retry-safely
       → local Relationship marked activated (unchanged, now sequenced after the real step)
  → redirect to the venue app's real /login
  → signInWithPassword succeeds — a real account, verified live in this pass
  → normal venue-app session, RLS-scoped via auth.uid() exactly as it already
    is for every other account in the product
```

**White Glove is unchanged**: no activation token is generated for it (same as before), so it never calls the new bridge — the manual Implementation checklist and the still-open question of how White Glove accounts eventually get provisioned are exactly as open as they were before this work, not touched or expanded.

**Not yet re-verified as part of this pass**: the real Stripe-signed webhook call itself (this pass tested the new endpoints directly with equivalent payloads, not a live Stripe Sandbox event) — that's the next, separate step in your own Stripe Sandbox E2E work, not something this change needed to re-prove.

No commit. No push.
