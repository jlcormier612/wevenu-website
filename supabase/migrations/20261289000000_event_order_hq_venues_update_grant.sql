-- ============================================================================
-- Event Order Minimum Safe Release — HQ enable/disable control
--
-- HQ flips venues.event_order_enabled via createAdminClient() (service_role).
-- service_role already has SELECT on venues (20260909000000) and bypasses RLS,
-- but table-level UPDATE was never granted — Enable Event Orders failed with
-- "permission denied for table venues".
--
-- Grant UPDATE only. Does not change column defaults, backfill rows, or alter
-- venue-facing RLS.
-- ============================================================================

grant update on public.venues to service_role;

notify pgrst, 'reload schema';
