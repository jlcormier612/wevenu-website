-- ============================================================================
-- Fix: two tables were created without the explicit grant to `authenticated`
-- that RLS depends on (same class of bug as the standing "migration needs
-- explicit grant" hazard) — discovered live via Postgres logs while
-- diagnosing an unrelated Booking Workspace error. Neither table's origin
-- migration (20260703140000_sprint75_couple_docs_venue_info.sql,
-- 20260709120000_sprint108_activation_engine.sql) granted select/insert/
-- update/delete to authenticated, so every query against them failed with
-- "permission denied" regardless of RLS policy content.
-- ============================================================================

grant select, insert, update, delete on public.venue_operational_info  to authenticated;
grant select, insert, update, delete on public.venue_activation_scores to authenticated;

notify pgrst, 'reload schema';
