-- ============================================================================
-- Work Package R3 — CRITICAL security fix found during this phase's own
-- cross-venue regression test (brief §48/§63: "Do not assume that because
-- the summary query is secure, the drill-down is secure. Test the
-- underlying detail endpoints too.").
--
-- `canonical_bookings` (20261221000000) is a plain view, created by the
-- `postgres` role while running migrations. Postgres views execute their
-- underlying query using the VIEW OWNER's privileges by default — and
-- `postgres` has BYPASSRLS. That means every query against
-- `canonical_bookings` was silently bypassing the real, correct RLS
-- policies on its underlying tables (clients/contracts/payment_schedules/
-- payment_line_items, all of which do have `venue_id = current_user_venue_id()`
-- policies — confirmed intact and correct). Any authenticated user of any
-- venue could read `canonical_bookings` filtered to a *different* venue_id
-- and see that venue's client/contract/booking data — verified live this
-- phase (Venue B's own session reading Venue A's canonical_bookings rows
-- with an explicit `.eq('venue_id', <Venue A>)` filter returned all of
-- them).
--
-- This is the same defensive pattern PostgreSQL 15+'s `security_invoker`
-- view option exists for: it makes the view run with the *querying* role's
-- own permissions and RLS context instead of the owner's. No formula,
-- join, or column changes — this is a security-context fix, not a
-- definition change; canonical_bookings' business meaning is untouched.
-- ============================================================================

alter view public.canonical_bookings set (security_invoker = true);

notify pgrst, 'reload schema';
