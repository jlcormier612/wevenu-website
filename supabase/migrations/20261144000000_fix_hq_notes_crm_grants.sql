-- ============================================================================
-- Fix missing service/authenticated grants on venue_hq_notes and
-- venue_hq_crm_state — found live while verifying White-Glove Phase 2
-- (venue_hq_tasks had the same gap, caught the same way, confirmed here for
-- the other two Support-section tables from the same original migration).
--
-- Both tables had real RLS policies gating on is_hq_admin() (correct), but
-- were never granted select/insert/update to `authenticated` at all — RLS
-- is evaluated only after the base GRANT already permits the operation, so
-- every addVenueNote/setNextContact/markVenueContacted call
-- (lib/hq/crm-service.ts) has been failing with "permission denied" this
-- whole time, regardless of RLS. Same root-cause shape as
-- venue_hq_tasks — a missing GRANT, not an RLS gap — caught the same way:
-- a real signed-session write attempt during Phase 2 verification.
-- ============================================================================

grant select, insert, update on public.venue_hq_tasks to authenticated;
grant select, insert, update on public.venue_hq_notes to authenticated;
grant select, insert, update on public.venue_hq_crm_state to authenticated;

notify pgrst, 'reload schema';
