-- ============================================================================
-- Sprint 107 — Team Collaboration
--
-- "A single user using Wevenu is a personal tool.
--  Two team members using it together is infrastructure."
--
-- Goal: convert "Jennifer's system" → "our system"
--
-- Changes:
--   1. Extend venue_staff with invitation columns
--   2. current_user_venue_id() DB helper — resolves owner OR team member
--   3. accept_team_invitation(p_token) RPC — atomic single-use token claim
--   4. venues SELECT policy — team members can read their venue
--   5. venue_staff RLS overhaul — team can read roster, owner manages it
--   6. All child table RLS policies replaced with venue_id = current_user_venue_id()
--   7. event_tasks assignment columns (assigned_to_staff_id, assigned_at)
-- ============================================================================


-- ── 1. Extend venue_staff ────────────────────────────────────────────────────

alter table public.venue_staff
  add column if not exists invite_token uuid unique default gen_random_uuid(),
  add column if not exists invited_by   uuid references auth.users(id) on delete set null,
  add column if not exists invited_at   timestamptz,
  add column if not exists accepted_at  timestamptz,
  add column if not exists is_active    boolean not null default true;

-- Owner rows are already accepted — backfill their accepted_at
update public.venue_staff
  set accepted_at = created_at
  where is_owner = true and accepted_at is null;

-- Pending invitations: do not set accepted_at (null = pending)


-- ── 2. current_user_venue_id() helper ────────────────────────────────────────
--
-- Security definer so the owner subquery (indexed on owner_user_id) runs with
-- privilege; stable so Postgres can cache within a query.
-- Returns null for unauthenticated users — RLS comparisons to null fail safely.

create or replace function public.current_user_venue_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select id    from public.venues     where owner_user_id = auth.uid() limit 1),
    (select venue_id from public.venue_staff
     where user_id     = auth.uid()
       and accepted_at is not null
       and is_active   = true
     limit 1)
  )
$$;

grant execute on function public.current_user_venue_id() to authenticated;


-- ── 3. accept_team_invitation(p_token) RPC ────────────────────────────────────
-- Mirrors claim_vendor_profile() pattern from sprint104_5 migration.
-- Atomic: find by invite_token, bind user, null the token.
-- Returns {ok, venueId, role} or {ok: false, error}.

create or replace function public.accept_team_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.venue_staff%rowtype;
begin
  select * into v_staff
  from public.venue_staff
  where invite_token = p_token
    and accepted_at  is null
    and is_active    = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  update public.venue_staff
  set user_id      = auth.uid(),
      accepted_at  = now(),
      invite_token = null
  where id = v_staff.id;

  return jsonb_build_object(
    'ok',      true,
    'venueId', v_staff.venue_id,
    'role',    v_staff.role
  );
end;
$$;

grant execute on function public.accept_team_invitation(uuid) to authenticated;


-- ── 4. venues table RLS — allow team member SELECT ────────────────────────────

drop policy if exists venues_select on public.venues;

create policy venues_select on public.venues
  for select
  using (id = public.current_user_venue_id());

-- venues INSERT/UPDATE/DELETE remain owner-only (unchanged)


-- ── 5. venue_staff RLS overhaul ───────────────────────────────────────────────

drop policy if exists venue_staff_all on public.venue_staff;

-- SELECT: all team members can read the roster (see each other)
create policy venue_staff_select on public.venue_staff
  for select
  using (venue_id = public.current_user_venue_id());

-- INSERT: only owner can add team members
create policy venue_staff_insert on public.venue_staff
  for insert
  with check (exists (
    select 1 from public.venues where id = venue_id and owner_user_id = auth.uid()
  ));

-- UPDATE: only owner can modify team members (role changes, deactivation)
create policy venue_staff_update on public.venue_staff
  for update
  using      (exists (select 1 from public.venues where id = venue_id and owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues where id = venue_id and owner_user_id = auth.uid()));

-- No DELETE policy — soft deletes only via is_active = false


-- ── 6. Child table RLS overhaul ───────────────────────────────────────────────
--
-- All tables that previously used:
--   exists (select 1 from venues v where v.id = venue_id and v.owner_user_id = auth.uid())
-- are updated to:
--   venue_id = public.current_user_venue_id()
--
-- This allows team members to access all coordinator workspace data.
-- The function guards ensure they only access their own venue.


-- venue_business_hours
drop policy if exists venue_business_hours_all on public.venue_business_hours;
create policy venue_business_hours_all on public.venue_business_hours
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- venue_spaces, venue_capacity_rules, date_holds, calendar_blocks
drop policy if exists venue_spaces_all         on public.venue_spaces;
drop policy if exists venue_capacity_rules_all on public.venue_capacity_rules;
drop policy if exists date_holds_all           on public.date_holds;
drop policy if exists calendar_blocks_all      on public.calendar_blocks;

create policy venue_spaces_all on public.venue_spaces
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy venue_capacity_rules_all on public.venue_capacity_rules
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy date_holds_all on public.date_holds
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy calendar_blocks_all on public.calendar_blocks
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- leads, lead_notes, lead_tasks, lead_activities, lead_signal_events
drop policy if exists leads_all              on public.leads;
drop policy if exists lead_notes_all         on public.lead_notes;
drop policy if exists lead_tasks_all         on public.lead_tasks;
drop policy if exists lead_activities_all    on public.lead_activities;
drop policy if exists lead_signal_events_all on public.lead_signal_events;

create policy leads_all on public.leads
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy lead_notes_all on public.lead_notes
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy lead_tasks_all on public.lead_tasks
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy lead_activities_all on public.lead_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy lead_signal_events_all on public.lead_signal_events
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- clients and related
drop policy if exists clients_all          on public.clients;
drop policy if exists client_notes_all     on public.client_notes;
drop policy if exists client_key_dates_all on public.client_key_dates;
drop policy if exists client_activities_all on public.client_activities;

create policy clients_all on public.clients
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_notes_all on public.client_notes
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_key_dates_all on public.client_key_dates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_activities_all on public.client_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- client_portal_sessions
drop policy if exists "venue owner manages portal sessions" on public.client_portal_sessions;
create policy "venue owner manages portal sessions" on public.client_portal_sessions
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- client_contacts
drop policy if exists "venue owner manages client contacts" on public.client_contacts;
create policy "venue owner manages client contacts" on public.client_contacts
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- events and related
drop policy if exists events_all          on public.events;
drop policy if exists event_notes_all     on public.event_notes;
drop policy if exists event_team_all      on public.event_team;
drop policy if exists event_activities_all on public.event_activities;
drop policy if exists event_questionnaires_all on public.event_questionnaires;
drop policy if exists event_tasks_all         on public.event_tasks;
drop policy if exists eva_all                 on public.event_vendor_assignments;

create policy events_all on public.events
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_notes_all on public.event_notes
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_team_all on public.event_team
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_activities_all on public.event_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_questionnaires_all on public.event_questionnaires
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_tasks_all on public.event_tasks
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy eva_all on public.event_vendor_assignments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- timeline_entries
drop policy if exists timeline_entries_all on public.timeline_entries;
create policy timeline_entries_all on public.timeline_entries
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- vendors: intentionally not swept here. Sprint 104.5 made `vendors` a
-- global entity (no `venue_id` column) with its own RLS
-- (venues_select_related_vendors / venues_insert_vendors /
-- vendor_users_update_profile via venue_vendor_relationships) — a
-- current_user_venue_id() sweep doesn't apply and would fail (no such column).

-- contracts and related
-- Note: contracts_sign_read (anon token-based signing) is intentionally preserved
drop policy if exists contract_templates_all  on public.contract_templates;
drop policy if exists contracts_all           on public.contracts;
drop policy if exists contracts_sign_read     on public.contracts;
drop policy if exists contract_activities_all on public.contract_activities;

create policy contract_templates_all on public.contract_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy contracts_all on public.contracts
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- Restore token-based read for the public signing page
create policy contracts_sign_read on public.contracts
  for select
  using (
    venue_id = public.current_user_venue_id()
    or (auth.uid() is null and status in ('sent', 'signed'))
  );

create policy contract_activities_all on public.contract_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- payments
drop policy if exists payment_schedules_all  on public.payment_schedules;
drop policy if exists payment_line_items_all on public.payment_line_items;
drop policy if exists payment_activities_all on public.payment_activities;

create policy payment_schedules_all on public.payment_schedules
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy payment_line_items_all on public.payment_line_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy payment_activities_all on public.payment_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- packages, invoices
drop policy if exists packages_all           on public.packages;
drop policy if exists package_items_all      on public.package_items;
drop policy if exists invoices_all           on public.invoices;
drop policy if exists invoice_line_items_all on public.invoice_line_items;
drop policy if exists invoice_activities_all on public.invoice_activities;

create policy packages_all on public.packages
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy package_items_all on public.package_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy invoices_all on public.invoices
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy invoice_line_items_all on public.invoice_line_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy invoice_activities_all on public.invoice_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- floor plans
drop policy if exists floor_plans_all        on public.floor_plans;
drop policy if exists floor_plan_objects_all on public.floor_plan_objects;

create policy floor_plans_all on public.floor_plans
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy floor_plan_objects_all on public.floor_plan_objects
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- documents
drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- luv tables
drop policy if exists luv_drafts_all on public.luv_drafts;
drop policy if exists luv_settings_all on public.luv_settings;

create policy luv_drafts_all on public.luv_drafts
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy luv_settings_all on public.luv_settings
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- message_threads, messages, message_attachments, message_events
drop policy if exists message_threads_all     on public.message_threads;
drop policy if exists messages_all            on public.messages;
drop policy if exists message_attachments_all on public.message_attachments;
drop policy if exists message_events_all      on public.message_events;

create policy message_threads_all on public.message_threads
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy messages_all on public.messages
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy message_attachments_all on public.message_attachments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy message_events_all on public.message_events
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- playbook_templates, playbook_tasks
drop policy if exists playbook_templates_all on public.playbook_templates;
drop policy if exists playbook_tasks_all     on public.playbook_tasks;

create policy playbook_templates_all on public.playbook_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy playbook_tasks_all on public.playbook_tasks
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- task_reminders, message_thread_participants
drop policy if exists "venue owner manages task reminders"        on public.task_reminders;
drop policy if exists "venue owner manages thread participants"   on public.message_thread_participants;

create policy "venue owner manages task reminders" on public.task_reminders
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venue owner manages thread participants" on public.message_thread_participants
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- notification_log (SELECT only — written by delivery engine via functions)
drop policy if exists "venue owner reads notification log" on public.notification_log;
create policy "venue owner reads notification log" on public.notification_log
  for select
  using (venue_id = public.current_user_venue_id());

-- notification_preferences
drop policy if exists "venue owner manages notification preferences" on public.notification_preferences;
create policy "venue owner manages notification preferences" on public.notification_preferences
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- tour_appointments
drop policy if exists "venue owner manages tour appointments" on public.tour_appointments;
create policy "venue owner manages tour appointments" on public.tour_appointments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- couple-owned data (read by coordinator workspace)
drop policy if exists "venue owner reads couple guests"        on public.couple_guests;
drop policy if exists "venue owner reads couple todos"         on public.couple_todos;
drop policy if exists "venue owner reads couple portal events" on public.couple_portal_events;
drop policy if exists "venue owner reads couple websites"      on public.couple_websites;
drop policy if exists "venue owner reads website views"        on public.couple_website_views;

create policy "venue owner reads couple guests" on public.couple_guests
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner reads couple todos" on public.couple_todos
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner reads couple portal events" on public.couple_portal_events
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner reads couple websites" on public.couple_websites
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner reads website views" on public.couple_website_views
  for select
  using (venue_id = public.current_user_venue_id());

-- invitation_emails (audit trail — SELECT only)
drop policy if exists "venue owner reads invitation emails" on public.invitation_emails;
create policy "venue owner reads invitation emails" on public.invitation_emails
  for select
  using (venue_id = public.current_user_venue_id());

-- couple_portal_collaboration
drop policy if exists "venue owner reads participants" on public.couple_portal_participants;
drop policy if exists "venue owner reads activity"     on public.couple_portal_activity;

create policy "venue owner reads participants" on public.couple_portal_participants
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner reads activity" on public.couple_portal_activity
  for select
  using (venue_id = public.current_user_venue_id());

-- client_media
drop policy if exists "venue owner sees shared media" on public.client_media;
create policy "venue owner sees shared media" on public.client_media
  for select
  using (venue_id = public.current_user_venue_id());

-- couple in-app messaging
drop policy if exists "venue_own_threads"              on public.couple_threads;
drop policy if exists "venue_own_messages"             on public.couple_messages;
drop policy if exists "venue_own_message_attachments"  on public.couple_message_attachments;

create policy "venue_own_threads" on public.couple_threads
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venue_own_messages" on public.couple_messages
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- couple_message_attachments has no direct venue_id — join through couple_messages
create policy "venue_own_message_attachments" on public.couple_message_attachments
  for all
  using (
    exists (
      select 1 from public.couple_messages cm
      where cm.id = message_id
        and cm.venue_id = public.current_user_venue_id()
    )
  )
  with check (
    exists (
      select 1 from public.couple_messages cm
      where cm.id = message_id
        and cm.venue_id = public.current_user_venue_id()
    )
  );

-- couple feedback, referrals, memories
drop policy if exists "venue owner manages feedback"  on public.couple_venue_feedback;
drop policy if exists "venue owner manages referrals" on public.couple_referrals;
drop policy if exists "venue owner manages memories"  on public.couple_memories;

create policy "venue owner manages feedback" on public.couple_venue_feedback
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venue owner manages referrals" on public.couple_referrals
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venue owner manages memories" on public.couple_memories
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- venue_notifications (two separate policies — INSERT via security definer only)
drop policy if exists "venue owner reads own notifications"   on public.venue_notifications;
drop policy if exists "venue owner updates own notifications" on public.venue_notifications;

create policy "venue owner reads own notifications" on public.venue_notifications
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner updates own notifications" on public.venue_notifications
  for update
  using (venue_id = public.current_user_venue_id());

-- venue_notification_preferences (two separate policies — INSERT via upsert function)
drop policy if exists "venue owner reads own prefs"   on public.venue_notification_preferences;
drop policy if exists "venue owner updates own prefs" on public.venue_notification_preferences;

create policy "venue owner reads own prefs" on public.venue_notification_preferences
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venue owner updates own prefs" on public.venue_notification_preferences
  for update
  using (venue_id = public.current_user_venue_id());

-- vendor_portal_sessions (team can manage vendor portal links)
drop policy if exists "venue owner manages vendor portal sessions" on public.vendor_portal_sessions;
create policy "venue owner manages vendor portal sessions" on public.vendor_portal_sessions
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- venue_anniversary_messages
drop policy if exists "venue owner manages anniversary messages" on public.venue_anniversary_messages;
create policy "venue owner manages anniversary messages" on public.venue_anniversary_messages
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- Luv sprint tables (96–102)
drop policy if exists "venues can submit feedback"       on public.venue_feedback;
drop policy if exists "venues can read own feedback"     on public.venue_feedback;
drop policy if exists "venues read own memories"         on public.luv_memories;
drop policy if exists "venues read own insights"         on public.luv_insights;
drop policy if exists "venues read own health score"     on public.venue_health_scores;
drop policy if exists "venues read own recommendations"  on public.luv_recommendations;
drop policy if exists "venue_actions_policy"             on public.luv_actions;
drop policy if exists "venue_action_outcomes_policy"     on public.luv_action_outcomes;

create policy "venues can submit feedback" on public.venue_feedback
  for insert
  with check (venue_id = public.current_user_venue_id());

create policy "venues can read own feedback" on public.venue_feedback
  for select
  using (venue_id = public.current_user_venue_id());

create policy "venues read own memories" on public.luv_memories
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venues read own insights" on public.luv_insights
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venues read own health score" on public.venue_health_scores
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venues read own recommendations" on public.luv_recommendations
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venue_actions_policy" on public.luv_actions
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- luv_action_outcomes has no venue_id column of its own — it's scoped one
-- level removed, via action_id -> luv_actions.venue_id (the original policy
-- here joined through a `venue_users` table that no longer exists; this
-- restores correct scoping using the same current_user_venue_id() this sweep
-- uses everywhere else).
create policy "venue_action_outcomes_policy" on public.luv_action_outcomes
  for all
  using      (action_id in (select id from public.luv_actions where venue_id = public.current_user_venue_id()))
  with check (action_id in (select id from public.luv_actions where venue_id = public.current_user_venue_id()));


-- ── 7. Task assignment columns ────────────────────────────────────────────────

alter table public.event_tasks
  add column if not exists assigned_to_staff_id uuid references public.venue_staff(id) on delete set null,
  add column if not exists assigned_at           timestamptz;

create index if not exists event_tasks_assignee
  on public.event_tasks (assigned_to_staff_id)
  where assigned_to_staff_id is not null;


notify pgrst, 'reload schema';
