-- ============================================================================
-- Seating release completion
--
-- - Explicit floor_plan_id on couple seating reads/writes (no updated_at /
--   first-plan fallback).
-- - Venue-authenticated floor-plan discovery (no borrowed portal token).
-- - Venue role gates: view any staff; edit/submit owner|manager|coordinator
--   + active delegation; revoke owner|manager.
-- - Block whole-floor-plan deletion when seating assignments, submissions,
--   or delegations exist.
-- - Surface lastSubmission + hasUnpublishedChanges on couple seating reads.
-- - Retire unused couple_guests.table_number and dead client_access='edit'.
-- ============================================================================

-- ── Role helpers ────────────────────────────────────────────────────────────

create or replace function public.seating_role_can_view()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_user_role() in ('owner', 'manager', 'coordinator', 'staff');
$$;

create or replace function public.seating_role_can_edit()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_user_role() in ('owner', 'manager', 'coordinator');
$$;

create or replace function public.seating_role_can_revoke()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_user_role() in ('owner', 'manager');
$$;

grant execute on function public.seating_role_can_view() to authenticated;
grant execute on function public.seating_role_can_edit() to authenticated;
grant execute on function public.seating_role_can_revoke() to authenticated;

-- ── Assignment fingerprint (live vs submitted snapshot drift) ───────────────

create or replace function public._seating_live_fingerprint(p_floor_plan_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    string_agg(guest_id::text || ':' || coalesce(table_object_id::text, 'null'), ',' order by guest_id),
    ''
  )
  from public.guest_seat_assignments
  where floor_plan_id = p_floor_plan_id;
$$;

create or replace function public._seating_snapshot_fingerprint(p_snapshot jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    string_agg(guest_id || ':' || table_id, ',' order by guest_id),
    ''
  )
  from (
    select (g->>'guestId') as guest_id, (t->>'id') as table_id
    from jsonb_array_elements(coalesce(p_snapshot->'tables', '[]'::jsonb)) t
    cross join lateral jsonb_array_elements(coalesce(t->'guests', '[]'::jsonb)) g
    union all
    select (g->>'guestId'), 'null'
    from jsonb_array_elements(coalesce(p_snapshot->'needsReassignment', '[]'::jsonb)) g
  ) s
  where guest_id is not null;
$$;

-- ── Block whole-floor-plan delete when seating history exists ───────────────

create or replace function public.prevent_floor_plan_delete_with_seating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_assignments integer;
  v_submissions integer;
  v_delegations integer;
begin
  select count(*) into v_assignments from public.guest_seat_assignments where floor_plan_id = old.id;
  select count(*) into v_submissions from public.seating_submissions where floor_plan_id = old.id;
  select count(*) into v_delegations from public.seating_delegations where floor_plan_id = old.id;

  if v_assignments > 0 or v_submissions > 0 or v_delegations > 0 then
    -- Single primary message (do not combine format-string RAISE with USING MESSAGE).
    raise exception using
      errcode = 'P0001',
      message = 'seating_data_exists: This floor plan has seating assignments, submissions, or delegation history. Remove or resolve seating data before deleting the plan.';
  end if;
  return old;
end;
$$;

drop trigger if exists floor_plans_prevent_delete_with_seating on public.floor_plans;
create trigger floor_plans_prevent_delete_with_seating
  before delete on public.floor_plans
  for each row execute function public.prevent_floor_plan_delete_with_seating();

-- Keep FK cascades for when deletion is allowed (no seating data). The
-- trigger above is the gate; cascades remain for empty plans.

-- ── Venue-authenticated plan discovery ──────────────────────────────────────

create or replace function public.list_venue_seating_floor_plans(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
begin
  if v_venue_id is null or not public.seating_role_can_view() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  if not exists (
    select 1 from public.events where id = p_event_id and venue_id = v_venue_id
  ) then
    return jsonb_build_object('error', 'event_not_found');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', fp.id,
      'name', fp.name,
      'sharedForSeating', fp.client_access is distinct from 'hidden',
      'isDelegated', exists (
        select 1 from public.seating_delegations d
        where d.floor_plan_id = fp.id and d.revoked_at is null
      ),
      'hasAssignments', exists (
        select 1 from public.guest_seat_assignments a where a.floor_plan_id = fp.id
      ),
      'lastSubmission', (
        select jsonb_build_object(
          'count', s.guest_count,
          'submittedAt', s.created_at,
          'submittedBy', s.submitted_by
        )
        from public.seating_submissions s
        where s.floor_plan_id = fp.id
        order by s.created_at desc
        limit 1
      )
    ) order by fp.created_at, fp.name)
    from public.floor_plans fp
    where fp.event_id = p_event_id and fp.venue_id = v_venue_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.list_venue_seating_floor_plans(uuid) to authenticated;

-- ── Couple get_seating_data — require explicit floor_plan_id ─────────────────

create or replace function public.get_seating_data(p_token text, p_floor_plan_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids        record;
  v_floor_plan_id uuid;
  v_result     jsonb;
  v_delegation record;
  v_latest     record;
  v_has_unpublished boolean := false;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object(
      'error', 'not_authorized',
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0, 'unconvertedPlusOnes', 0)
    );
  end if;

  if p_floor_plan_id is null then
    return jsonb_build_object(
      'error', 'floor_plan_required',
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0, 'unconvertedPlusOnes', 0)
    );
  end if;

  select fp.id into v_floor_plan_id from public.floor_plans fp
  where fp.id = p_floor_plan_id and fp.event_id = v_ids.event_id and fp.client_access != 'hidden';

  if v_floor_plan_id is null then
    return jsonb_build_object(
      'error', 'floor_plan_not_found',
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0, 'unconvertedPlusOnes', 0)
    );
  end if;

  v_result := public._build_seating_json(v_ids.client_id, v_ids.venue_id, v_floor_plan_id);

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = v_floor_plan_id and revoked_at is null;

  select * into v_latest from public.seating_submissions
  where floor_plan_id = v_floor_plan_id
  order by created_at desc limit 1;

  if v_latest.id is not null then
    v_has_unpublished := public._seating_live_fingerprint(v_floor_plan_id)
      is distinct from public._seating_snapshot_fingerprint(v_latest.snapshot);
  end if;

  return v_result || jsonb_build_object(
    'hadPriorWork', true,
    'isDelegated', v_delegation.id is not null,
    'delegationId', v_delegation.id,
    'delegatedNote', v_delegation.note,
    'lastSubmission', case when v_latest.id is null then null else jsonb_build_object(
      'count', v_latest.guest_count,
      'submittedAt', v_latest.created_at,
      'submittedBy', v_latest.submitted_by
    ) end,
    'hasUnpublishedChanges', v_has_unpublished
  );
end;
$$;

-- ── Couple assign / remove — require explicit floor_plan_id ──────────────────

create or replace function public.assign_guest_to_table(
  p_token text, p_guest_id uuid, p_table_id uuid, p_floor_plan_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_floor_plan_id uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level in ('financial', 'view_only') then return false; end if;
  if p_floor_plan_id is null then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  select fp.id into v_floor_plan_id
  from public.floor_plan_objects o
  join public.floor_plans fp on fp.id = o.floor_plan_id
  where o.id = p_table_id
    and fp.id = p_floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.client_access != 'hidden'
    and o.object_type in ('table_round', 'table_rect', 'table_oval');

  if v_floor_plan_id is null then return false; end if;

  if exists (
    select 1 from public.seating_delegations
    where floor_plan_id = v_floor_plan_id and revoked_at is null
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, floor_plan_id, table_object_id)
  values (p_guest_id, v_floor_plan_id, p_table_id)
  on conflict (guest_id, floor_plan_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;

create or replace function public.remove_guest_assignment(
  p_token text, p_guest_id uuid, p_floor_plan_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level in ('financial', 'view_only') then return false; end if;
  if p_floor_plan_id is null then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.seating_delegations
    where floor_plan_id = p_floor_plan_id and revoked_at is null
  ) then
    return false;
  end if;

  -- Refuse if the plan isn't seating-shared for this event.
  if not exists (
    select 1 from public.floor_plans
    where id = p_floor_plan_id and event_id = v_ids.event_id and client_access != 'hidden'
  ) then
    return false;
  end if;

  delete from public.guest_seat_assignments
  where guest_id = p_guest_id and floor_plan_id = p_floor_plan_id;
  return true;
end;
$$;

-- ── Operational read — role gate ────────────────────────────────────────────

create or replace function public.get_operational_seating_plan(p_event_id uuid, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_client_id uuid;
  v_delegation record;
  v_latest record;
begin
  if v_venue_id is null or not public.seating_role_can_view() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  select client_id into v_client_id from public.events where id = p_event_id and venue_id = v_venue_id;
  if v_client_id is null then return jsonb_build_object('error', 'event_not_found'); end if;

  if not exists (
    select 1 from public.floor_plans where id = p_floor_plan_id and event_id = p_event_id and venue_id = v_venue_id
  ) then
    return jsonb_build_object('error', 'floor_plan_not_found');
  end if;

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and revoked_at is null;

  if v_delegation.id is not null then
    return public._build_seating_json(v_client_id, v_venue_id, p_floor_plan_id)
      || jsonb_build_object(
        'isDelegated', true,
        'delegationId', v_delegation.id,
        'delegatedAt', v_delegation.granted_at,
        'delegatedNote', v_delegation.note
      );
  end if;

  select * into v_latest from public.seating_submissions
  where floor_plan_id = p_floor_plan_id
  order by created_at desc limit 1;

  if v_latest.id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb, 'needsReassignment', '[]'::jsonb,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0),
      'isDelegated', false, 'notYetSubmitted', true
    );
  end if;

  return v_latest.snapshot || jsonb_build_object(
    'isDelegated', false, 'notYetSubmitted', false,
    'submittedAt', v_latest.created_at, 'submittedBy', v_latest.submitted_by
  );
end;
$$;

-- ── Venue assign / remove — role + delegation ───────────────────────────────

create or replace function public.assign_guest_to_table_as_venue(
  p_floor_plan_id uuid, p_guest_id uuid, p_table_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_client_id uuid;
begin
  if v_venue_id is null or not public.seating_role_can_edit() then return false; end if;
  if not exists (
    select 1 from public.seating_delegations
    where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null
  ) then
    return false;
  end if;

  select e.client_id into v_client_id
  from public.floor_plans fp join public.events e on e.id = fp.event_id
  where fp.id = p_floor_plan_id and fp.venue_id = v_venue_id;
  if v_client_id is null then return false; end if;

  if not exists (
    select 1 from public.couple_guests g
    where g.id = p_guest_id and g.client_id = v_client_id and g.venue_id = v_venue_id
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.floor_plan_objects o
    where o.id = p_table_id and o.floor_plan_id = p_floor_plan_id
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, floor_plan_id, table_object_id)
  values (p_guest_id, p_floor_plan_id, p_table_id)
  on conflict (guest_id, floor_plan_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;

create or replace function public.remove_guest_assignment_as_venue(
  p_floor_plan_id uuid, p_guest_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_venue_id uuid := current_user_venue_id();
begin
  if v_venue_id is null or not public.seating_role_can_edit() then return false; end if;
  if not exists (
    select 1 from public.seating_delegations
    where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null
  ) then
    return false;
  end if;

  delete from public.guest_seat_assignments
  where guest_id = p_guest_id and floor_plan_id = p_floor_plan_id;
  return true;
end;
$$;

create or replace function public.submit_seating_plan_as_venue(p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_delegation record;
  v_client_id uuid;
  v_event_id uuid;
  v_snapshot jsonb;
  v_submission_id uuid;
  v_completed_task_id uuid;
begin
  if v_venue_id is null or not public.seating_role_can_edit() then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null;
  if v_delegation.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_delegated');
  end if;

  v_client_id := v_delegation.client_id;
  v_event_id := v_delegation.event_id;

  v_snapshot := public._build_seating_json(v_client_id, v_venue_id, p_floor_plan_id);

  insert into public.seating_submissions (client_id, venue_id, event_id, floor_plan_id, snapshot, guest_count, submitted_by)
  values (v_client_id, v_venue_id, v_event_id, p_floor_plan_id, v_snapshot,
          coalesce((v_snapshot -> 'stats' ->> 'totalAssigned')::integer, 0), 'venue')
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'seating_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_venue_id;
  end loop;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id);
end;
$$;

create or replace function public.revoke_seating_delegation_as_venue(p_delegation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_venue_id uuid := current_user_venue_id();
begin
  if v_venue_id is null or not public.seating_role_can_revoke() then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  update public.seating_delegations
  set revoked_at = now(), revoked_by = 'venue'
  where id = p_delegation_id and venue_id = v_venue_id and revoked_at is null;

  return jsonb_build_object('ok', found);
end;
$$;

-- ── Couple floor-plan list: add hasAssignments for empty-state clarity ──────

create or replace function public.get_seating_floor_plans(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', fp.id, 'name', fp.name,
      'isDelegated', exists (
        select 1 from public.seating_delegations d
        where d.floor_plan_id = fp.id and d.revoked_at is null
      ),
      'hasAssignments', exists (
        select 1 from public.guest_seat_assignments a where a.floor_plan_id = fp.id
      ),
      'lastSubmission', (
        select jsonb_build_object('count', s.guest_count, 'submittedAt', s.created_at, 'submittedBy', s.submitted_by)
        from public.seating_submissions s
        where s.floor_plan_id = fp.id
        order by s.created_at desc limit 1
      )
    ) order by fp.created_at, fp.name)
    from public.floor_plans fp
    where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
  ), '[]'::jsonb);
end;
$$;

-- ── Debt: retire unused table_number and dead client_access='edit' ──────────

alter table public.couple_guests drop column if exists table_number;

update public.floor_plans set client_access = 'view' where client_access = 'edit';

alter table public.floor_plans drop constraint if exists floor_plans_client_access_check;
alter table public.floor_plans
  add constraint floor_plans_client_access_check
  check (client_access in ('view', 'hidden'));
