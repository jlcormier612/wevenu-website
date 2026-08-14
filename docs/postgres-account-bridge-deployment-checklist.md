# Postgres Account-Provisioning Bridge — Deployment Readiness Checklist

**Type:** Deployment planning only. No code changes made or required by this review.
**Date:** 2026-08-14
**Scope:** Moving the exact implementation in `docs/postgres-account-bridge-implementation.md` from local verification to a production/Sandbox-reachable state. Not touching the bridge, White Glove, or product-sync scope.

---

## 1. Migration deployment

- Apply `supabase/migrations/20261293000000_venue_enrollments.sql` directly against the production Postgres database (via the Supabase Dashboard SQL editor or a direct `psql` connection) — **not** via `supabase db push`.
- Reason, not a new finding — already on record from an earlier pass this engagement: 4 unresolved migration-timestamp collision groups exist in this repo's migration history, explicitly flagged as "worth a check before the first real `supabase db push`/`migration up`." This repo has applied every migration to date by direct SQL for exactly this reason. This migration's own timestamp doesn't collide with anything — it's simply safest to keep using the same proven apply method rather than being the first migration to go through the untested CLI push path.
- After applying, record the version in `supabase_migrations.schema_migrations` (same convention used for every prior migration this session and before), so the tracked history stays honest.
- Verify after applying: `venue_enrollments` table exists, `activate_venue_enrollment` function exists, and — this matters — confirm the fixed version of the function is what's live (the one that does **not** null `activation_token` on success; see the implementation report's "bug found and fixed" section). If production was ever touched by an earlier draft, re-run the `CREATE OR REPLACE FUNCTION` to be sure.

## 2. Vercel environment variables, by app

Three independent Vercel projects — none of these are shared automatically.

**Venue app (`app/`):**
| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the new "Hello to Cheers Production" key |
| `FROM_EMAIL` | `Hello to Cheers <hello@hellotocheers.com>` — **not** `EMAIL_FROM`, this app only reads `FROM_EMAIL` |
| `PRODUCT_SYNC_API_KEY` | a real generated secret — must be **byte-identical** to the value set in marketing/ and workspace/ below |
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production Supabase project values (pre-existing requirement, confirm present) |

**Marketing app (`marketing/`):**
| Variable | Value |
|---|---|
| `RESEND_API_KEY` | same production key |
| `EMAIL_FROM` | `Hello to Cheers <hello@hellotocheers.com>` |
| `EMAIL_REPLY_TO` | `jen@hellotocheers.com` |
| `PRODUCT_API_BASE_URL` | the venue app's real production URL (not localhost) |
| `PRODUCT_SYNC_API_KEY` | same value as above |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | production/Sandbox SaaS billing values — separate from the venue app's own Stripe Connect keys, and separate concern from your own in-progress Stripe Sandbox E2E work |

**Workspace app (`workspace/`):**
| Variable | Value |
|---|---|
| `RESEND_API_KEY` | same production key |
| `EMAIL_FROM` | `Hello to Cheers <hello@hellotocheers.com>` |
| `PRODUCT_API_BASE_URL` | the venue app's real production URL |
| `PRODUCT_SYNC_API_KEY` | same value as above |
| `NEXT_PUBLIC_PRODUCT_APP_URL` | the venue app's real production URL — drives both the post-activation redirect and the "already activated → go to sign in" link |

**One thing worth checking, not assuming:** `PRODUCT_SYNC_API_KEY` was already required for the *existing* legal-acceptance bridge (`/api/internal/legal/venue-activate`, called from both marketing/ and workspace/) before this work — it isn't new to this deployment. If it was never actually set in production, that step has likely been silently failing there already. Worth confirming its current production state rather than assuming it's fine because it predates this change.

## 3. Resend

Already done on your side (DKIM/SPF verified, sending enabled, receiving intentionally on Google Workspace). Nothing further needed here beyond placing the production key correctly per app/variable-name above — this was the subject of the prior request and doesn't change with this bridge.

## 4. Stripe / webhook configuration

Not modified by this bridge, and presumably already in motion as your separate Stripe Sandbox E2E work — listed here only for completeness of this checklist:
- Marketing's `checkout.session.completed` webhook endpoint (and the other subscribed events: `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`) must be registered in Stripe against marketing's real deployed URL, with `STRIPE_WEBHOOK_SECRET` matching the signing secret Stripe issues for that specific endpoint.
- This bridge doesn't add, remove, or change any Stripe-side configuration — it only changes what `createVenueEnrollment` does *after* the webhook fires. If your Stripe Sandbox webhook wiring already works today, no additional Stripe-side change is needed for this bridge specifically.

## 5. Proxy / public-route configuration

Already handled in code, not a separate manual step: `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` now includes `/api/internal/enrollment`, alongside the pre-existing `/api/internal/product-access` and `/api/internal/legal` entries. This ships automatically the moment the venue app is deployed with this code — nothing to configure in a dashboard. Worth an explicit check in the E2E sequence below only because a proxy/middleware miss is exactly the kind of thing that fails silently as a redirect rather than a clear error.

## 6. Deployment order

Dependencies run one direction — marketing/workspace call *into* the venue app, never the reverse:

1. **Apply the migration** to production Postgres (§1) — before any app code that depends on the new table/function is live.
2. **Deploy the venue app** with the new routes and the `PUBLIC_PATHS` change. Confirm it's live before proceeding — marketing/workspace's calls will fail (connection error, logged, non-fatal to the rest of enrollment) if the receiving side isn't there yet.
3. **Deploy marketing**, with `PRODUCT_API_BASE_URL` pointing at the now-live venue app.
4. **Deploy workspace**, same dependency.
5. Only once all three are live and env vars are confirmed set: let real Stripe events reach the webhook (i.e., this is the point where a real Sandbox checkout is safe to run end to end).

## 7. Exact E2E test sequence

1. Confirm `venue_enrollments` exists and `activate_venue_enrollment` is the fixed version (§1).
2. Confirm all env vars in §2 are present in each Vercel project (values can't be verified from here — presence and matching the shared secret across all three is what to check).
3. Run one real Stripe Sandbox checkout through marketing's real UI/Payment Link with a Sandbox test card, self-setup ("Launch Yourself") onboarding.
4. Check marketing's deploy logs for `[stripe] checkout.session.completed → venue enrollment` and confirm **no** `[crm] Postgres enrollment bridge failed` line.
5. Query the production `venue_enrollments` table directly: one new row, `status = 'pending'`, a real `activation_token`, correct `venue_name`/`owner_email`.
6. Confirm the welcome email actually arrives in the real inbox used for checkout, with a working `Activate Account` link pointing at the production workspace URL.
7. Open the link — confirm the Activate Account page renders with the correct venue name/email (this reads from the local Relationship record, unchanged, so it's also an implicit check that the two systems agree).
8. Submit a real password. Confirm redirect to the venue app's real `/login?activated=1`.
9. Log in with the new email/password. Confirm a real venue-app session starts and portal/dashboard access works.
10. Query production directly: a real `venues` row and a real `auth.users` row exist, correctly linked; `venue_enrollments.status = 'activated'`.
11. Re-open the *same* activation link a second time. Confirm it correctly shows "already activated" / sends you to sign in, rather than erroring or attempting to reactivate (this is the retry-safety path — worth proving in the real environment, not just locally).
12. Decide, deliberately, whether to delete this one Sandbox test venue afterward or keep it as a working demo — your call, not something to default either way.

---

No blockers found in this review that require a code change. The one standing risk (§1, migration-timestamp collisions) has a known, already-proven workaround (direct SQL apply) rather than requiring new code. If the E2E sequence above surfaces something that doesn't hold in the real environment, that's the point to come back with specifics rather than treating this checklist as the last word.
