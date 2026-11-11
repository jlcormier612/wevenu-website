-- Temporary Sandbox-only fault hook for proving book_relationship is one transaction.
-- Disabled by default. Only book_relationship_sandbox_fault sets the GUC.

create or replace function public.book_relationship(
  p_venue_id uuid,
  p_client_id uuid,
  p_space_id uuid default null,
  p_pipeline_stage_id uuid default null,
  p_name text default null,
  p_event_type text default null,
  p_event_date date default null,
  p_event_end_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_setup_time time default null,
  p_teardown_time time default null,
  p_guest_count integer default null,
  p_lifecycle_origin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_lead_id uuid;
  v_previous_stage text;
  v_event_id uuid;
  v_existing_booked_at date;
  v_existing_date date;
  v_event_date date;
  v_event_end date;
  v_name text;
  v_primary text;
  v_partner text;
  v_newly boolean := false;
  v_origin text;
  v_booked_on date;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  select * into v_client
  from public.clients
  where id = p_client_id and venue_id = p_venue_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Client not found.');
  end if;

  v_lead_id := v_client.lead_id;
  if v_lead_id is not null then
    select sales_stage into v_previous_stage
    from public.leads
    where id = v_lead_id and venue_id = p_venue_id
    for update;
  end if;

  select e.id, e.booked_at, e.event_date
    into v_event_id, v_existing_booked_at, v_existing_date
  from public.events e
  where e.venue_id = p_venue_id
    and e.client_id = p_client_id
    and e.status <> 'cancelled'
  order by (e.booked_at is null), e.created_at
  limit 1
  for update;

  v_event_date := coalesce(p_event_date, v_client.event_date);
  if v_event_id is not null and v_existing_booked_at is not null
     and p_event_date is not null and p_event_date is distinct from v_existing_date then
    return jsonb_build_object(
      'ok', false,
      'message', 'This relationship is already Booked.'
    );
  end if;

  -- A brand-new event needs a date. Restoring a cancelled event can keep its own date.
  if v_event_id is not null and v_existing_booked_at is null and v_event_date is null then
    return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
  end if;

  v_primary := trim(both ' ' from concat_ws(' ', v_client.first_name, v_client.last_name));
  v_partner := trim(both ' ' from concat_ws(' ', nullif(v_client.partner_first_name, ''), nullif(v_client.partner_last_name, '')));
  v_name := case
    when p_name is not null and length(trim(p_name)) > 0 then trim(p_name)
    when v_partner <> '' then v_primary || ' & ' || v_partner
    else v_primary
  end;
  if v_name is null or v_name = '' then
    v_name := 'Event';
  end if;
  v_event_end := coalesce(p_event_end_date, v_client.end_date);
  if v_event_end is not distinct from v_event_date then
    v_event_end := null;
  end if;
  v_booked_on := (timezone(public._venue_scheduling_timezone(p_venue_id), now()))::date;
  v_origin := coalesce(
    p_lifecycle_origin,
    case when v_lead_id is not null then 'pipeline' else 'direct' end
  );

  if v_event_id is not null and v_existing_booked_at is not null then
    v_newly := false;
  elsif v_event_id is not null and v_existing_booked_at is null then
    update public.events
      set status = 'confirmed',
          booked_at = v_booked_on,
          name = v_name,
          event_type = coalesce(nullif(p_event_type, ''), v_client.event_type),
          event_date = v_event_date,
          event_end_date = v_event_end,
          start_time = coalesce(p_start_time, v_client.ceremony_time, start_time),
          end_time = coalesce(p_end_time, v_client.reception_time, end_time),
          setup_time = coalesce(p_setup_time, setup_time),
          teardown_time = coalesce(p_teardown_time, teardown_time),
          guest_count = coalesce(p_guest_count, v_client.guest_count),
          space_id = coalesce(p_space_id, space_id),
          booking_celebration_pending = true
    where id = v_event_id and venue_id = p_venue_id;
    v_newly := true;
  else
    select e.id into v_event_id
    from public.events e
    where e.venue_id = p_venue_id
      and e.client_id = p_client_id
      and e.status = 'cancelled'
      and e.booked_at is not null
    order by e.created_at desc
    limit 1
    for update;

    if v_event_id is not null then
      if v_event_date is null then
        select event_date into v_event_date from public.events where id = v_event_id;
      end if;
      update public.events
        set status = 'confirmed',
            name = coalesce(nullif(trim(p_name), ''), name),
            event_type = coalesce(nullif(p_event_type, ''), event_type),
            event_date = coalesce(p_event_date, event_date),
            event_end_date = coalesce(p_event_end_date, event_end_date),
            start_time = coalesce(p_start_time, start_time),
            end_time = coalesce(p_end_time, end_time),
            setup_time = coalesce(p_setup_time, setup_time),
            teardown_time = coalesce(p_teardown_time, teardown_time),
            guest_count = coalesce(p_guest_count, guest_count),
            space_id = coalesce(p_space_id, space_id)
      where id = v_event_id and venue_id = p_venue_id;
      v_newly := false;
    else
      if v_event_date is null then
        return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
      end if;
      insert into public.events (
        venue_id, client_id, space_id, status, name, event_type,
        event_date, event_end_date, start_time, end_time, setup_time, teardown_time,
        guest_count, booked_at, booking_celebration_pending
      ) values (
        p_venue_id, p_client_id, p_space_id, 'confirmed', v_name,
        coalesce(nullif(p_event_type, ''), v_client.event_type),
        v_event_date, v_event_end,
        coalesce(p_start_time, v_client.ceremony_time),
        coalesce(p_end_time, v_client.reception_time),
        p_setup_time, p_teardown_time,
        coalesce(p_guest_count, v_client.guest_count),
        v_booked_on, true
      )
      returning id into v_event_id;
      v_newly := true;
    end if;
  end if;

  update public.clients
    set status = 'confirmed',
        lifecycle_booked_at = coalesce(lifecycle_booked_at, now()),
        lifecycle_booking_origin = coalesce(lifecycle_booking_origin, v_origin)
  where id = p_client_id and venue_id = p_venue_id;
  if not found then
    raise exception 'Client not found.';
  end if;

  if v_lead_id is not null then
    update public.leads
      set sales_stage = 'booked',
          pipeline_stage_id = coalesce(p_pipeline_stage_id, pipeline_stage_id),
          lost_reason = null,
          lost_reason_detail = null,
          lost_at = null,
          first_booked_at = coalesce(first_booked_at, now())
    where id = v_lead_id and venue_id = p_venue_id;
    if not found then
      raise exception 'Lead not found for this client.';
    end if;
  end if;

  -- Attach existing preparation. Do not insert a second copy.
  update public.event_tasks
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.event_playbook_applications a
    set event_id = v_event_id
  where a.venue_id = p_venue_id and a.client_id = p_client_id and a.event_id is null
    and not exists (
      select 1 from public.event_playbook_applications x
      where x.event_id = v_event_id and x.kind = a.kind
    );

  update public.timeline_sections
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.timeline_entries
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.floor_plans
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.event_orders o
    set event_id = v_event_id
  where o.venue_id = p_venue_id and o.client_id = p_client_id and o.event_id is null
    and not exists (
      select 1 from public.event_orders x where x.event_id = v_event_id
    );

  update public.event_vendor_assignments a
    set event_id = v_event_id
  where a.venue_id = p_venue_id and a.client_id = p_client_id and a.event_id is null
    and not exists (
      select 1 from public.event_vendor_assignments x
      where x.event_id = v_event_id and x.vendor_id = a.vendor_id
    );

  if current_setting('htc.book_relationship_force_fail', true) = 'on' then
    raise exception 'SANDBOX_BOOK_RELATIONSHIP_FORCE_FAIL after Event, Booked state, and planning attachment';
  end if;

  return jsonb_build_object(
    'ok', true,
    'newly_booked', v_newly,
    'event_id', v_event_id,
    'client_id', p_client_id,
    'lead_id', v_lead_id,
    'previous_sales_stage', v_previous_stage
  );
end;
$$;

revoke all on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text) from public;
grant execute on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text) to authenticated, service_role;


-- Sandbox-only fault injection. Transaction-local GUC; default callers never set it.
create or replace function public.book_relationship_sandbox_fault(
  p_venue_id uuid,
  p_client_id uuid,
  p_space_id uuid default null,
  p_pipeline_stage_id uuid default null,
  p_name text default null,
  p_event_type text default null,
  p_event_date date default null,
  p_event_end_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_setup_time time default null,
  p_teardown_time time default null,
  p_guest_count integer default null,
  p_lifecycle_origin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('htc.book_relationship_force_fail', 'on', true);
  return public.book_relationship(
    p_venue_id, p_client_id, p_space_id, p_pipeline_stage_id,
    p_name, p_event_type, p_event_date, p_event_end_date,
    p_start_time, p_end_time, p_setup_time, p_teardown_time,
    p_guest_count, p_lifecycle_origin
  );
end;
$$;

revoke all on function public.book_relationship_sandbox_fault(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text) from public;
grant execute on function public.book_relationship_sandbox_fault(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text) to service_role;
