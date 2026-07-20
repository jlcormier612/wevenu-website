-- ============================================================================
-- Corrective migration — the prior migration added a trailing
-- p_floor_plan_id parameter to get_seating_data, assign_guest_to_table,
-- and remove_guest_assignment via CREATE OR REPLACE. Per this project's
-- own established discipline, changing a function's parameter list (even
-- by appending a defaulted parameter) creates a NEW overload rather than
-- replacing the old one — confirmed live via pg_proc: all three showed
-- count=2 after the prior migration applied. This drops the old,
-- now-superseded signatures explicitly.
-- ============================================================================

drop function if exists public.get_seating_data(text);
drop function if exists public.assign_guest_to_table(text, uuid, uuid);
drop function if exists public.remove_guest_assignment(text, uuid);
