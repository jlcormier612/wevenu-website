-- ============================================================================
-- Completes service_role grants for cold venue INSERT side effects.
--
-- After 20261379000000, venues INSERT still fails because AFTER INSERT
-- trigger venues_seed_default_automation_rules (20261119000000) inserts
-- into public.automation_rules as the inserting role (service_role), and
-- that table only had SELECT for service_role (20260903000000).
--
-- venue_schedule_item_types seed trigger already has service_role DML
-- from 20261352000000.
-- ============================================================================

grant select, insert, update on public.automation_rules to service_role;
