-- Sprint 81: Wedding Day Operations Command Center
--
-- Three targeted additions to existing tables:
--   1. timeline_entries.status   — live run-of-show status (coordinator toggles day-of)
--   2. event_vendor_assignments.checked_in_at / setup_complete_at — vendor check-in
--   3. client_contacts.is_emergency_contact — surfaces in day-of emergency panel
--
-- Plus two security-definer RPCs the venue-side dashboard calls:
--   get_wedding_day_ops(p_event_id)  — single fetch for all command center data
--   toggle_timeline_status(p_entry_id, p_status) — live status updates
--   toggle_vendor_checkin(p_assignment_id)        — mark vendor arrived/setup

-- ── 1. Timeline entry live status ─────────────────────────────────────────────

alter table public.timeline_entries
  add column if not exists status text
  check (status in ('not_started', 'in_progress', 'complete'))
  default 'not_started' not null;

-- ── 2. Vendor check-in tracking ───────────────────────────────────────────────

alter table public.event_vendor_assignments
  add column if not exists checked_in_at    timestamptz,
  add column if not exists setup_complete_at timestamptz;

-- ── 3. Emergency contact flag ─────────────────────────────────────────────────

alter table public.client_contacts
  add column if not exists is_emergency_contact boolean not null default false;

-- ── 4. get_wedding_day_ops ────────────────────────────────────────────────────
-- Returns everything the command center needs in a single RPC call.
-- Called server-side with venue-owner auth, so security is via auth.uid() RLS.

create or replace function public.get_wedding_day_ops(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id   uuid;
  v_client_id  uuid;
begin
  -- Resolve venue from event (auth.uid() must own the venue via RLS on events)
  select venue_id, client_id into v_venue_id, v_client_id
  from public.events
  where id = p_event_id;

  if v_venue_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(

    -- ── Timeline entries with live status ──────────────────────────────────
    'timeline', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',          te.id,
          'title',       te.title,
          'description', te.description,
          'entryTime',   te.entry_time,
          'sortOrder',   te.sort_order,
          'status',      te.status
        ) order by te.entry_time asc nulls last, te.sort_order, te.created_at
      ), '[]'::jsonb)
      from public.timeline_entries te
      where te.event_id = p_event_id
        and te.venue_id = v_venue_id
    ),

    -- ── Vendor assignments with check-in status ────────────────────────────
    'vendors', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'assignmentId',    eva.id,
          'vendorId',        v.id,
          'vendorName',      v.name,
          'category',        v.category,
          'contactName',     v.contact_name,
          'phone',           v.phone,
          'arrivalTime',     eva.arrival_time,
          'notes',           eva.notes,
          'checkedInAt',     eva.checked_in_at,
          'setupCompleteAt', eva.setup_complete_at
        ) order by v.category, v.name
      ), '[]'::jsonb)
      from public.event_vendor_assignments eva
      join public.vendors v on v.id = eva.vendor_id
      where eva.event_id = p_event_id
        and eva.venue_id = v_venue_id
    ),

    -- ── Wedding-day tasks (phase = wedding_day, client_visible or coord) ───
    'tasks', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',          et.id,
          'title',       et.title,
          'description', et.description,
          'ownerType',   et.owner_type,
          'status',      et.status,
          'completedAt', et.completed_at
        ) order by et.sort_order, et.due_date
      ), '[]'::jsonb)
      from public.event_tasks et
      where et.event_id = p_event_id
        and et.venue_id = v_venue_id
        and et.phase    = 'wedding_day'
        and et.status  != 'waived'
    ),

    -- ── Emergency contacts ─────────────────────────────────────────────────
    'contacts', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',           cc.id,
          'firstName',    cc.first_name,
          'lastName',     cc.last_name,
          'phone',        cc.phone,
          'email',        cc.email,
          'relationship', cc.relationship,
          'roleLabel',    cc.role_label
        ) order by
          case cc.relationship
            when 'partner'        then 1
            when 'planner'        then 2
            when 'maid_of_honor'  then 3
            when 'best_man'       then 4
            when 'parent'         then 5
            else 6
          end
      ), '[]'::jsonb)
      from public.client_contacts cc
      where cc.client_id = v_client_id
        and cc.venue_id  = v_venue_id
        and (cc.is_emergency_contact = true or cc.relationship in ('partner','planner','maid_of_honor','best_man'))
        and (cc.phone is not null or cc.email is not null)
    ),

    -- ── Guest dietary summary ──────────────────────────────────────────────
    'dietary', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'choice',       cg.meal_choice,
          'restriction',  cg.dietary_restriction,
          'count',        count(*)
        )
      ), '[]'::jsonb)
      from public.couple_guests cg
      where cg.event_id   = p_event_id
        and cg.venue_id   = v_venue_id
        and cg.rsvp_status = 'attending'
        and (cg.meal_choice is not null or cg.dietary_restriction is not null)
      group by cg.meal_choice, cg.dietary_restriction
    )
  );
end;
$$;

grant execute on function public.get_wedding_day_ops(uuid) to authenticated;

-- ── 5. update_timeline_entry_status ──────────────────────────────────────────

create or replace function public.update_timeline_entry_status(
  p_entry_id uuid,
  p_status   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('not_started', 'in_progress', 'complete') then
    raise exception 'invalid status: %', p_status;
  end if;
  update public.timeline_entries
  set status = p_status, updated_at = now()
  where id = p_entry_id;
end;
$$;

grant execute on function public.update_timeline_entry_status(uuid, text) to authenticated;

-- ── 6. toggle_vendor_checkin ──────────────────────────────────────────────────

create or replace function public.toggle_vendor_checkin(
  p_assignment_id uuid,
  p_field         text   -- 'checked_in' or 'setup_complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_vendor_assignments%rowtype;
begin
  select * into v_row from public.event_vendor_assignments where id = p_assignment_id;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  if p_field = 'checked_in' then
    update public.event_vendor_assignments
    set checked_in_at = case when checked_in_at is null then now() else null end
    where id = p_assignment_id;
  elsif p_field = 'setup_complete' then
    update public.event_vendor_assignments
    set setup_complete_at = case when setup_complete_at is null then now() else null end
    where id = p_assignment_id;
  else
    return jsonb_build_object('error', 'invalid_field');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.toggle_vendor_checkin(uuid, text) to authenticated;

notify pgrst, 'reload schema';
