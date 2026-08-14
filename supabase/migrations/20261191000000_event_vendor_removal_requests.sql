-- ============================================================================
-- Event vendor removal requests — venue remains source of truth
--
-- Couple unpick+resubmit and vendor "Request to leave" never delete
-- event_vendor_assignments. They create a pending venue-facing request;
-- venue Assign Remove (existing hard DELETE) remains authoritative and
-- cascades conversations / availability as today.
-- ============================================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

create table if not exists public.event_vendor_removal_requests (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  vendor_id       uuid not null references public.vendors(id) on delete cascade,
  -- SET NULL so history survives venue Remove (row marked approved first).
  assignment_id   uuid references public.event_vendor_assignments(id) on delete set null,
  requested_by    text not null check (requested_by in ('couple', 'vendor')),
  reason          text,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'dismissed')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  constraint event_vendor_removal_requests_resolved_ck
    check (
      (status = 'pending' and resolved_at is null)
      or (status <> 'pending' and resolved_at is not null)
    )
);

create index if not exists evrr_event_pending
  on public.event_vendor_removal_requests (event_id, status)
  where status = 'pending';

create index if not exists evrr_venue_pending
  on public.event_vendor_removal_requests (venue_id, status, created_at desc)
  where status = 'pending';

create index if not exists evrr_assignment
  on public.event_vendor_removal_requests (assignment_id)
  where assignment_id is not null;

-- One open request per assignment per requester type.
create unique index if not exists evrr_one_pending_per_requester
  on public.event_vendor_removal_requests (assignment_id, requested_by)
  where status = 'pending' and assignment_id is not null;

alter table public.event_vendor_removal_requests enable row level security;

-- Venue staff: read/update (dismiss) own venue rows. Inserts via security
-- definer RPCs / couple submit path.
drop policy if exists evrr_venue_select on public.event_vendor_removal_requests;
create policy evrr_venue_select on public.event_vendor_removal_requests
  for select using (venue_id = public.current_user_venue_id());

drop policy if exists evrr_venue_update on public.event_vendor_removal_requests;
create policy evrr_venue_update on public.event_vendor_removal_requests
  for update
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- Vendors may read their own requests (hide Request-to-leave when pending).
drop policy if exists evrr_vendor_select on public.event_vendor_removal_requests;
create policy evrr_vendor_select on public.event_vendor_removal_requests
  for select using (vendor_id = public.current_user_vendor_id());

grant select, update on public.event_vendor_removal_requests to authenticated;


-- ── 2. Venue notification on create ───────────────────────────────────────────

create or replace function public._trigger_vendor_removal_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_name text;
  v_event_name  text;
  v_title       text;
  v_body        text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select business_name into v_vendor_name from public.vendors where id = new.vendor_id;
  select name into v_event_name from public.events where id = new.event_id;

  if new.requested_by = 'couple' then
    v_title := 'Couple asked to remove a vendor';
    v_body := coalesce(v_event_name, 'An event')
      || ' — couple withdrew '
      || coalesce(v_vendor_name, 'a vendor')
      || '. Remove from event?';
  else
    v_title := 'Vendor requested to leave';
    v_body := coalesce(v_vendor_name, 'A vendor')
      || ' asked to leave '
      || coalesce(v_event_name, 'an event')
      || case
           when new.reason is not null and length(trim(new.reason)) > 0
             then ': ' || left(trim(new.reason), 200)
           else '.'
         end;
  end if;

  perform public.create_venue_notification(
    new.venue_id,
    new.event_id,
    'vendor_removal_requested',
    v_title,
    v_body,
    '/events/' || new.event_id || '#vendors',
    '👋'
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists vendor_removal_request_notification
  on public.event_vendor_removal_requests;
create trigger vendor_removal_request_notification
  after insert on public.event_vendor_removal_requests
  for each row execute function public._trigger_vendor_removal_request_notification();


-- ── 3. Helper — upsert pending request (idempotent) ───────────────────────────

create or replace function public._upsert_pending_vendor_removal_request(
  p_venue_id      uuid,
  p_event_id      uuid,
  p_vendor_id     uuid,
  p_assignment_id uuid,
  p_requested_by  text,
  p_reason        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_assignment_id is null then
    return null;
  end if;

  select id into v_id
  from public.event_vendor_removal_requests
  where assignment_id = p_assignment_id
    and requested_by = p_requested_by
    and status = 'pending'
  limit 1;

  if v_id is not null then
    if p_reason is not null and length(trim(p_reason)) > 0 then
      update public.event_vendor_removal_requests
      set reason = left(trim(p_reason), 1000)
      where id = v_id and (reason is null or reason = '');
    end if;
    return v_id;
  end if;

  insert into public.event_vendor_removal_requests (
    venue_id, event_id, vendor_id, assignment_id, requested_by, reason, status
  ) values (
    p_venue_id, p_event_id, p_vendor_id, p_assignment_id, p_requested_by,
    case when p_reason is not null and length(trim(p_reason)) > 0
      then left(trim(p_reason), 1000) else null end,
    'pending'
  )
  returning id into v_id;

  return v_id;
exception when unique_violation then
  select id into v_id
  from public.event_vendor_removal_requests
  where assignment_id = p_assignment_id
    and requested_by = p_requested_by
    and status = 'pending'
  limit 1;
  return v_id;
end;
$$;


-- ── 4. Vendor RPC — Request to leave ──────────────────────────────────────────

create or replace function public.request_event_assignment_removal(
  p_assignment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_row public.event_vendor_assignments%rowtype;
  v_request_id uuid;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_row
  from public.event_vendor_assignments
  where id = p_assignment_id and vendor_id = v_vendor_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_request_id := public._upsert_pending_vendor_removal_request(
    v_row.venue_id, v_row.event_id, v_row.vendor_id, v_row.id, 'vendor', p_reason
  );

  return jsonb_build_object('ok', true, 'requestId', v_request_id);
end;
$$;

grant execute on function public.request_event_assignment_removal(uuid, text)
  to authenticated;


-- ── 5. submit_vendor_list — shortlist only + couple removal requests ──────────
-- Assignments are never deleted here. Unpick+resubmit opens a venue-facing
-- remove request when the vendor is still assigned.

create or replace function public.submit_vendor_list(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id uuid;
  v_event_id  uuid;
  v_snapshot  jsonb;
  v_count     integer;
  v_submission_id uuid;
  v_completed_task_id uuid;
  v_newly_assigned jsonb;
  v_removal_requests jsonb;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date limit 1;
  if v_event_id is null then return jsonb_build_object('ok', false, 'error', 'event_not_found'); end if;

  -- Commit shortlist: picked ↔ selected (venue notification trigger keys off selected_at).
  update public.event_vendor_recommendations
  set selected_at = case when picked_at is not null then coalesce(selected_at, now()) else null end
  where event_id = v_event_id and venue_id = v_session_venue_id
    and (picked_at is not null) != (selected_at is not null);

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'recommendationId', evr.id, 'vendorId', vnd.id, 'vendorName', vnd.business_name,
      'category', vnd.category, 'note', evr.note
    ) order by vnd.category, vnd.business_name), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  where evr.event_id = v_event_id and evr.venue_id = v_session_venue_id and evr.selected_at is not null;

  insert into public.vendor_selection_submissions (client_id, venue_id, event_id, snapshot, selected_count)
  values (p_client_id, v_session_venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  -- Idempotent assignments for every currently-selected vendor. Does NOT
  -- remove assignments when a couple unpicks+resubmits — venue may already
  -- be coordinating. Unique (event_id, vendor_id) makes re-submit a no-op.
  with inserted as (
    insert into public.event_vendor_assignments (venue_id, event_id, vendor_id, notes)
    select v_session_venue_id, v_event_id, evr.vendor_id, 'Selected by couple'
    from public.event_vendor_recommendations evr
    where evr.event_id = v_event_id
      and evr.venue_id = v_session_venue_id
      and evr.selected_at is not null
    on conflict (event_id, vendor_id) do nothing
    returning id, vendor_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', i.id,
    'vendorId', i.vendor_id
  )), '[]'::jsonb)
  into v_newly_assigned
  from inserted i;

  -- Couple re-selected: dismiss their pending remove requests for those vendors.
  update public.event_vendor_removal_requests r
  set status = 'dismissed', resolved_at = now()
  where r.event_id = v_event_id
    and r.venue_id = v_session_venue_id
    and r.requested_by = 'couple'
    and r.status = 'pending'
    and exists (
      select 1 from public.event_vendor_recommendations evr
      where evr.event_id = r.event_id
        and evr.vendor_id = r.vendor_id
        and evr.selected_at is not null
    );

  -- Couple withdrew (not on shortlist) but still assigned → venue-facing request.
  with created as (
    select public._upsert_pending_vendor_removal_request(
      eva.venue_id, eva.event_id, eva.vendor_id, eva.id, 'couple', null
    ) as request_id,
    eva.vendor_id,
    eva.id as assignment_id
    from public.event_vendor_assignments eva
    where eva.event_id = v_event_id
      and eva.venue_id = v_session_venue_id
      and not exists (
        select 1 from public.event_vendor_recommendations evr
        where evr.event_id = eva.event_id
          and evr.vendor_id = eva.vendor_id
          and evr.selected_at is not null
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', c.request_id,
    'vendorId', c.vendor_id,
    'assignmentId', c.assignment_id
  ) order by c.vendor_id), '[]'::jsonb)
  into v_removal_requests
  from created c
  where c.request_id is not null;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'vendor_selected'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session_venue_id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'submissionId', v_submission_id,
    'selectedCount', v_count,
    'newlyAssigned', coalesce(v_newly_assigned, '[]'::jsonb),
    'removalRequests', coalesce(v_removal_requests, '[]'::jsonb),
    'eventId', v_event_id,
    'venueId', v_session_venue_id
  );
end;
$$;


notify pgrst, 'reload schema';
