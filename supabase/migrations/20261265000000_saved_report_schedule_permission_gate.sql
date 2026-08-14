-- Work Package D7C follow-up — a real gap caught by live testing (not a
-- guess): `saved_report_schedules` had only the standard permissive,
-- venue-scoped RLS policy, while `lib/saved-reports/service.ts::setSchedule`
-- gates creating/editing a schedule to Owner/Manager at the app layer only.
-- Confirmed live: an authenticated Staff session could INSERT a schedule
-- directly via the REST API, bypassing the service-layer check entirely —
-- exactly the "app check is UX, RLS is the real boundary" class of gap
-- this codebase has hardened repeatedly before (TR-L1/TR-L2/TR-L5, the D2/
-- D6 Template Permission Defect). A schedule sends a recurring outbound
-- email to an address the requester controls — the same weight class as
-- those prior fixes, so it gets the same treatment: a RESTRICTIVE policy,
-- not a rewrite of the permissive `_all` policy (which stays, for SELECT/
-- DELETE — any team member can still see or remove a schedule; only
-- creating/editing one is gated).

create policy saved_report_schedules_write_gate on public.saved_report_schedules
  as restrictive
  for insert
  with check (current_user_role() = any (array['owner', 'manager']));

create policy saved_report_schedules_update_gate on public.saved_report_schedules
  as restrictive
  for update
  using (current_user_role() = any (array['owner', 'manager']));

notify pgrst, 'reload schema';
