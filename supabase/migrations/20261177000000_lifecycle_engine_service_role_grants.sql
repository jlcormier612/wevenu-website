-- Venue Lifecycle Automation Completion Pass (2026-08-04), Phase 5/9.
--
-- Same bug class as 20261176000000 (task_reminders), found by actually
-- running the complete lifecycle through the real processors rather than
-- reading the code and assuming it works. service_role bypasses RLS, but
-- still needs an ordinary table-level GRANT — nothing here changes RLS
-- policy on any of these tables, every one keeps working exactly as it
-- does for authenticated sessions today.
--
-- Scoped precisely to what the service-role code paths actually do, not a
-- blanket grant: verified against every .from(...) call in
-- lib/automation/*, lib/notifications/engine.ts, lib/playbooks/repository.ts
-- (as called from applyPlaybookToEvent, service-role-invoked from both
-- lib/automation/actions.ts and lib/automation/system-guarantees.ts), and
-- lib/message-sequences/repository.ts (as called from the service-role
-- sequence-materialization path). Tables these files only ever touch
-- through an authenticated session, or only through a SECURITY DEFINER
-- RPC (e.g. create_venue_notification), are correctly left untouched.

grant select on public.documents to service_role;
grant select, insert, delete on public.event_task_context_links to service_role;
grant select on public.message_sequences to service_role;
grant select on public.message_templates to service_role;
grant insert on public.notification_log to service_role;
grant select, insert, delete on public.playbook_task_attachments to service_role;
grant select on public.sequence_steps to service_role;
grant select on public.timeline_entries to service_role;
grant select on public.venue_staff to service_role;
