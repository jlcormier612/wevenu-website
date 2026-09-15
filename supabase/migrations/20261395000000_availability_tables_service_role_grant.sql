-- Availability foundation (20260627060000) granted venue_spaces (and sibling
-- availability tables) to `authenticated` only. Service-role tooling — fixture
-- seed scripts, admin diagnostics, and any engine that reads spaces without a
-- user session — hits Postgres privilege denial 42501 even though service_role
-- bypasses RLS. Same class of gap as 20261176000000_task_reminders_service_role_grant.
-- Does not change RLS policies for authenticated/anon.

grant select, insert, update, delete on public.venue_spaces to service_role;
grant select, insert, update, delete on public.venue_capacity_rules to service_role;
grant select, insert, update, delete on public.date_holds to service_role;
grant select, insert, update, delete on public.calendar_blocks to service_role;
