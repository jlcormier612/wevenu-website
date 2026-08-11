-- Work Package D8 — a real, live-confirmed gap found during this phase's
-- audit: `playbook_milestones` had only the standard permissive,
-- venue-scoped `_all` policy — no RESTRICTIVE Owner/Manager delete gate,
-- unlike its two direct siblings in the same feature (`playbook_tasks`,
-- `playbook_templates`), both already gated
-- (20260722000000_planning_playbook_milestones.sql created this table
-- alongside those two without carrying the same protection over). Any
-- active Staff/Coordinator could delete a milestone "chapter" outright —
-- exactly the D2/D6 Template Permission Defect pattern recurring in a
-- table that predates that fix and was missed by it.

create policy playbook_milestones_delete_gate on public.playbook_milestones
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

notify pgrst, 'reload schema';
