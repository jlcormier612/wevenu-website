# Postgres-Backed Auth Architecture — Findings

**Type:** Inspection only. No code, schema, or configuration changes were made.
**Date:** 2026-08-13
**Context:** Reconciling the instruction "Postgres, not Supabase, is the product backend/auth authority" against what the codebase actually implements today.

---

## Headline finding, before the detail

I need to flag this clearly rather than quietly work around it: **Supabase Auth is not a peripheral or legacy detail in this codebase. It is the single identity mechanism underneath the entire authorization model, for every account type, everywhere.** The evidence is unambiguous and I want to walk you through it before proposing anything, because it directly changes what "smallest production-appropriate architecture" actually means here.

---

## 1. What currently represents venue, owner, users, and credentials

| Concept | Where it lives | Notes |
|---|---|---|
| Venue | `public.venues` | `owner_user_id uuid not null` — points at an identity row, but there is **no separate `public.users` table** to point at |
| Owner/staff identity | `auth.users` (Supabase's own schema) | Confirmed by direct query: **zero** custom `public.users`, `public.credentials`, or `public.*password*` table exists anywhere in the schema. Identity is `auth.users`, full stop — there is no parallel "product's own" user table today, not even a shadow/mirror one. |
| Password/credential storage | `auth.users` / `auth.identities` (Supabase's own schema, managed by Supabase's GoTrue) | Not something the product's own code touches directly — it's set via the Supabase Auth API (`admin.createUser`, `signInWithPassword`, `updateUser`), never a raw `UPDATE auth.users SET encrypted_password = ...`. |
| Staff roster | `public.venue_staff` | Role/invite state for people *within* a venue; still points at `auth.users.id` for who the person is |

**There is no existing "product's own Postgres-backed account model" to build on** — the pattern to migrate *away from* and the pattern to migrate *to* are, today, the same table.

---

## 2. What authentication/login implementation currently exists

- Login: `app/auth/actions.ts` → `supabase.auth.signInWithPassword(...)`. This is the actual, live login path for every venue owner and staff member who signs into the product today.
- Session mechanism: `@supabase/ssr`'s `createServerClient` (`integrations/supabase/server.ts`), cookie-based, refreshed via `proxy.ts` middleware. Standard Supabase Auth session pattern, not a custom JWT/session scheme.
- The exact `auth.admin.createUser()` pattern you're asking about is **already the established, working, twice-proven pattern** for two other account types in this same codebase:
  - `lib/client-auth/service.ts` — couple/client portal accounts: `admin.auth.admin.createUser({email, password, email_confirm:true})` immediately followed by `supabase.auth.signInWithPassword(...)` to establish the real session.
  - `lib/vendor-auth/service.ts` — vendor accounts, same shape.
- I did not find any code, comment, migration, or doc anywhere in the repo describing an intended *replacement* for Supabase Auth. There's no in-progress custom auth system to hand this off to — no session table, no JWT-issuing endpoint, no password-hashing utility outside what Supabase's own API does internally.

---

## 3. Legacy vs. required — this is the finding that changes the plan

You asked me to determine which Supabase Auth references are legacy versus still required. I queried this directly rather than estimating:

- **360** total RLS policies exist in the `public` schema.
- **45** reference `auth.uid()` directly.
- **205 more** reference `current_user_venue_id()` — a helper function that itself calls `auth.uid()` internally (I read its definition earlier this engagement: it resolves the caller's venue by checking `venues.owner_user_id = auth.uid()`, falling back to `venue_staff.user_id = auth.uid()`).
- **51 distinct Postgres functions** in the `public` schema call `auth.uid()` directly — including every core identity-resolution helper the rest of the schema depends on: `current_user_role`, `current_user_venue_id`, `current_user_vendor_id`, `current_user_vendor_role`, `is_hq_admin`, `current_hq_admin_role`, `get_actor_context`, plus dozens of feature-specific RPCs (vendor claiming, team invites, portal participant acceptance, Luv, notifications, search, referrals, feedback...).

That's roughly **70% of all RLS policies in the schema**, directly or one hop away from `auth.uid()`, covering essentially every domain of the product — not an isolated corner that happens to still use Supabase.

**None of this is legacy in the sense of "old code nobody relies on."** It is the live, current, sole authorization mechanism for the entire application, today, right now, for every existing account.

---

## 4. How the existing `auth.admin.createUser()` usages should be treated

This is where I need your steer rather than guessing, because two very different plans follow from two different readings of your instruction, and I don't think it's responsible to pick one silently:

**Reading A — "Don't use the Supabase Auth *product* as the identity/session/authorization layer at all."** Taken literally, this means the 51 functions and 360 RLS policies above would eventually all need to be rewritten against a different identity-resolution mechanism (a custom `public.users`/sessions table, a custom JWT verified inside Postgres, or similar), and the login/session code (`app/auth/actions.ts`, `integrations/supabase/server.ts`, `proxy.ts`) would need to be replaced too. This is not a "smallest architecture for an account-creation bridge" — it's a full authorization-layer rewrite of the entire product, and it's a materially different, much larger engagement than what this task describes. I don't think this is actually what's wanted, but I want to name it explicitly rather than let it be the silent implication of "treat Supabase as legacy."

**Reading B — "Don't delegate the *credential-establishment step of new-venue-owner signup* to Supabase's own hosted invite/reset-password flow; the product should control that moment itself."** This is a real, coherent, much smaller decision — and it's compatible with everything else staying exactly as it is. Under this reading, the account still ultimately lives in `auth.users` (because that's what `auth.uid()` and 250+ policies require), but the product's own code — not a Supabase-sent email, not Supabase's own password-reset UI — is what captures the password and finalizes the account, using the same `admin.auth.admin.createUser()` + `signInWithPassword()` shape already proven for clients and vendors. "Postgres-backed" in this reading means: the enrollment record, the activation token, and the bridge logic all live in your own Postgres tables (not the current local JSON file store) — while the actual account row still has to be an `auth.users` row, because that's the only thing every existing RLS policy in the product knows how to authorize.

I can't write one "proposed implementation plan" without knowing which of these you mean — they differ by roughly two orders of magnitude in scope, risk, and what "smallest" even means.

---

## 5. Where the enrollment → real account bridge should live

This part is answerable regardless of the Reading A/B question:

- It should not stay in the current local, file-backed JSON store (`shared/relationships`) — that store isn't visible to RLS or to the venue app's Postgres database at all, which is exactly why nothing real gets created today.
- It should live as a real table (or small set of tables) in the product's own Postgres database — e.g., an `enrollments` or `venue_enrollments` table with a unique constraint on the Stripe checkout session/subscription id (idempotency), a status column, and a foreign key to the resulting `venues` row once provisioned — following the same idempotent-webhook pattern already used elsewhere in this codebase (Facebook Lead Ads, QuickBooks sync, Stripe Connect webhooks all already implement exactly this "unique external event id" idempotency shape).
- The actual account-creation step (whatever Reading A/B resolves to) should be a single, transactional server-side function/endpoint — internal-only, service-role or signed-secret authenticated — matching the pattern the codebase already uses for its one comparable internal endpoint (`app/api/internal/product-access/lock`). This is genuinely the smallest-footprint choice regardless of which reading you pick, since that pattern already exists and is proven.

---

## Scope decision (resolved)

**Confirmed: Reading B — the signup credential-establishment step only.** `auth.uid()`, all 360 RLS policies, the login/session mechanism, and client/vendor account creation stay exactly as they are — none of that is in scope and none of it needs to change. What follows is the plan for the narrow, bounded piece: making the enrollment → activation → real account bridge Postgres-backed and real, using the same `admin.auth.admin.createUser()` + `signInWithPassword()` shape already proven twice in this codebase, driven by the product's own code rather than Supabase's hosted invite/reset-password flow.

---

## 6. Proposed implementation plan

**Not implemented yet — plan only, per your instruction.**

### 6.1 — Two new Postgres tables, in the venue app's own database

Replacing the two things the local JSON file store (`shared/relationships`) currently holds for this specific journey — the enrollment record and the activation token — with real tables the product's own RLS-bearing Postgres already governs:

- **`venue_enrollments`** — `id`, `stripe_checkout_session_id` (unique — idempotency key, matching the same pattern already used for Facebook Lead Ads/QuickBooks/Stripe Connect webhooks elsewhere in this codebase), `stripe_customer_id`, `stripe_subscription_id`, `venue_name`, `owner_email`, `plan`, `onboarding_type` (`self_setup` / `white_glove`), `status` (`pending` / `activated`), `activation_token` (nullable, cleared on use), `activation_token_created_at`, `venue_id` (nullable FK to `venues`, set once provisioned), `created_at`, `updated_at`.
- RLS: service-role/internal-only — no authenticated end-user ever reads or writes this table directly, matching how the codebase already treats other internal-only tables.
- No password or password hash is stored here or anywhere in the product's own schema — Supabase's own `auth.users.encrypted_password` remains the single place a credential lives, exactly as it already does for every other account type. This explicitly removes the one part of today's simulation (`recordOwnerActivationCredential` persisting a `passwordHash`) that would otherwise become a second, redundant place a credential could live.

### 6.2 — Two new internal endpoints in the venue app (`app/`)

Same authentication pattern as the one comparable endpoint that already exists (`app/api/internal/product-access/lock` — service-role/signed-secret, internal-only):

1. **`POST /api/internal/enrollment/upsert`** — called by `marketing/`'s existing `checkout.session.completed` webhook handler in place of today's local-file `createVenueEnrollment` write. Idempotent upsert keyed on `stripe_checkout_session_id`. Generates and returns the activation token (same crypto-random, single-use, 30-day-TTL design already in place today — that part doesn't need to change, just where it's stored).
2. **`POST /api/internal/enrollment/activate`** — called by `workspace/`'s existing activation action in place of today's `recordOwnerActivationCredential` simulation. Given `{token, password}`:
   - Looks up the enrollment by token; rejects if missing/expired — same logic already in `lookupActivationToken`, just against Postgres instead of the JSON file.
   - If already `activated`, returns success idempotently rather than erroring (a retry after a network blip must not strand the owner) — matches the existing `already_activated` state the activation page already handles in its UI today.
   - In one transaction: creates the real account via `admin.auth.admin.createUser({email, password, email_confirm:true})` (tolerating "already registered" as non-fatal, exactly as `lib/client-auth/service.ts` already does), creates the real `venues` row with that user as `owner_user_id`, and marks the enrollment `activated` with the resulting `venue_id`.
   - This is the one genuinely new piece of application logic in this whole plan — a real "create a venue" code path doesn't exist anywhere today (confirmed: zero `.from("venues").insert(` call sites in the product) — but it's a small, single, transactional function, not a new subsystem.

### 6.3 — Two small edits to existing code, not new systems

- `marketing/app/api/stripe/webhook/route.ts`'s `handleCheckoutCompleted` — swap the local-store write for a call to 6.2.1. The welcome email step (already real, already correctly Resend-configured per your last request) is untouched — it already just needs a token and a venue name, which the new endpoint still provides.
- `workspace/app/activate/actions.ts`'s `activateAccountAction` — swap `recordOwnerActivationCredential` for a call to 6.2.2. The form, validation, and redirect-to-`/login` are untouched.

### 6.4 — What this deliberately does not touch

The broader 7-step `enqueueProductSync` pipeline (workspace/website/subscription/onboarding/launch steps, and the White Glove manual checklist) stays exactly as stubbed as it is today. Building this narrow bridge doesn't require finishing that pipeline — the venue name and owner account are now real and loggable-into the moment activation completes, which is everything the E2E journey you described needs. The rest of that pipeline remains a separate, later decision, not something this plan silently expands into.

### 6.5 — Net result against your stated requirements

- **Real, persistent, loggable-into Postgres-backed account:** yes — a real `venues` row and a real `auth.users` row, created transactionally at the moment of activation.
- **Secure password handling:** yes — the password never touches the product's own tables; it's handed once, over the same request, to Supabase's own credential-hashing (`admin.createUser`), the same mechanism already trusted for client and vendor accounts today.
- **Idempotent/retry-safe enrollment:** yes — unique constraint on the Stripe session id for enrollment creation, and an explicit "already activated → succeed, don't error" branch for activation, both matching patterns already proven elsewhere in this codebase.

I have not written any of this yet. Tell me if this plan is approved as scoped, or if any piece of it should change, before I touch anything.
