-- ============================================================================
-- TR-G6 — DELETE role-gate on the core-data table set
--
-- Manager Permissions Architecture Remediation (docs/manager-permissions-
-- architecture-remediation-plan.md). Sprint 107 gave 44 tables a blanket
-- "for all using (venue_id = current_user_venue_id())" policy with no role
-- clause. TR-G1 later split out role-aware policies for 4 of those 44
-- (contracts, invoices, payment_line_items, payment_schedules) plus
-- venue_staff. The other 40 were never revisited — any active team member,
-- including Staff, still has full INSERT/UPDATE/DELETE on all of them.
-- Live-tested during the Manager Permissions Release Readiness audit: a real
-- Staff account hard-deleted a `clients` row via a raw DELETE, with zero
-- permission check anywhere in the path — a capability the app's own UI
-- doesn't expose to any role.
--
-- Fix scope (per the reviewed plan): DELETE only. INSERT/UPDATE on these
-- tables is normal, expected, everyday collaborative use today (Staff
-- editing a client's guest count, adding a lead note, placing a floor plan
-- object) with no evidence it's unwanted — restricting it would be a real
-- product-behavior change, not a security fix, and is explicitly left as a
-- separate, later decision rather than folded in here.
--
-- Mechanism: rather than dropping and re-splitting each table's existing
-- "_all" policy (which risks drifting from whatever later, unrelated
-- migrations may have done to some of these tables' SELECT/INSERT/UPDATE
-- shape since sprint107), this migration adds one RESTRICTIVE policy per
-- table scoped to FOR DELETE only. Postgres ANDs restrictive policies with
-- the existing permissive "_all" policy for the same command, so DELETE
-- becomes owner/manager-only while every other command on these tables is
-- completely untouched — the existing "_all" policy is not modified at all.
-- Same current_user_role() helper TR-G1 already established; no new
-- mechanism introduced.
-- ============================================================================

create policy calendar_blocks_delete_gate on public.calendar_blocks as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy client_activities_delete_gate on public.client_activities as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy client_key_dates_delete_gate on public.client_key_dates as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy client_notes_delete_gate on public.client_notes as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy clients_delete_gate on public.clients as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy contract_activities_delete_gate on public.contract_activities as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy contract_templates_delete_gate on public.contract_templates as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy date_holds_delete_gate on public.date_holds as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy documents_delete_gate on public.documents as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy event_activities_delete_gate on public.event_activities as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy event_notes_delete_gate on public.event_notes as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy event_questionnaires_delete_gate on public.event_questionnaires as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy event_tasks_delete_gate on public.event_tasks as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy event_team_delete_gate on public.event_team as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy event_vendor_assignments_delete_gate on public.event_vendor_assignments as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy events_delete_gate on public.events as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy floor_plan_objects_delete_gate on public.floor_plan_objects as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy floor_plans_delete_gate on public.floor_plans as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy invoice_activities_delete_gate on public.invoice_activities as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy invoice_line_items_delete_gate on public.invoice_line_items as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy lead_activities_delete_gate on public.lead_activities as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy lead_notes_delete_gate on public.lead_notes as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy lead_signal_events_delete_gate on public.lead_signal_events as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy lead_tasks_delete_gate on public.lead_tasks as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy leads_delete_gate on public.leads as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy luv_drafts_delete_gate on public.luv_drafts as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy luv_settings_delete_gate on public.luv_settings as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy message_attachments_delete_gate on public.message_attachments as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy message_events_delete_gate on public.message_events as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy message_threads_delete_gate on public.message_threads as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy messages_delete_gate on public.messages as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy package_items_delete_gate on public.package_items as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy packages_delete_gate on public.packages as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy payment_activities_delete_gate on public.payment_activities as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy playbook_tasks_delete_gate on public.playbook_tasks as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy playbook_templates_delete_gate on public.playbook_templates as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy timeline_entries_delete_gate on public.timeline_entries as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy venue_business_hours_delete_gate on public.venue_business_hours as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy venue_capacity_rules_delete_gate on public.venue_capacity_rules as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));

create policy venue_spaces_delete_gate on public.venue_spaces as restrictive for delete
  using (current_user_role() in ('owner', 'manager'));
