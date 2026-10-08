-- Assign active venue-required vendors onto the event in book_relationship.
-- Source: venue_vendor_relationships.is_required (not Setup Profile requiredVendorIds).
-- Idempotent; does not block commercial Booked / occupancy.

-- Confirmed manual booking occupancy.
-- book_relationship accepts the venue's submitted date, end date, times, and
-- spaces. Assignments are written in this transaction before booked_at so
-- occupancy validation sees the final space set. Hold conversion stays in
-- this function and rolls back with any occupancy failure.
-- Contract and payment automation do not call this function.

drop function if exists public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text);

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
  p_lifecycle_origin text default null,
  p_confirmed_occupancy jsonb default null
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
  v_hold_end date;
  v_relationship_id uuid;
  v_source text;
  v_confirmed boolean := false;
  v_conf_start time;
  v_conf_end time;
  v_primary_space uuid;
  v_space_ids uuid[];
  v_max_sim integer;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  perform set_config('htc.authorize_booked_stage', 'on', true);

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
  v_confirmed := p_confirmed_occupancy is not null;
  if v_confirmed then
    begin
      v_event_date := nullif(btrim(p_confirmed_occupancy->>'eventDate'), '')::date;
      v_event_end := nullif(btrim(p_confirmed_occupancy->>'eventEndDate'), '')::date;
      v_conf_start := nullif(btrim(p_confirmed_occupancy->>'startTime'), '')::time;
      v_conf_end := nullif(btrim(p_confirmed_occupancy->>'endTime'), '')::time;
      select coalesce(array_agg(distinct sid), '{}'::uuid[])
        into v_space_ids
      from (
        select nullif(btrim(p_confirmed_occupancy->>'spaceId'), '')::uuid as sid
        union
        select nullif(btrim(a.value->>'spaceId'), '')::uuid
        from jsonb_array_elements(coalesce(p_confirmed_occupancy->'assignments', '[]'::jsonb)) a(value)
      ) s
      where sid is not null;
      v_primary_space := nullif(btrim(p_confirmed_occupancy->>'spaceId'), '')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Enter a valid date, time, and space.');
    end;
    if v_event_date is null then
      return jsonb_build_object('ok', false, 'message', 'A date is required before booking this relationship.');
    end if;
    if v_event_end is not null and v_event_end < v_event_date then
      return jsonb_build_object('ok', false, 'message', 'The end date cannot be before the event date.');
    end if;
    if v_event_end is not distinct from v_event_date then
      v_event_end := null;
    end if;
    select coalesce(r.max_simultaneous_events, 1) into v_max_sim
    from public.venue_capacity_rules r
    where r.venue_id = p_venue_id;
    if v_max_sim is null or v_max_sim < 1 then
      v_max_sim := 1;
    end if;
    if v_max_sim >= 2 and coalesce(cardinality(v_space_ids), 0) = 0 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Assign an Event Space before booking. This venue can host more than one event at the same time.'
      );
    end if;
    if coalesce(cardinality(v_space_ids), 0) > 0 and exists (
      select 1 from unnest(v_space_ids) u(sid)
      where not exists (
        select 1 from public.venue_spaces s
        where s.id = u.sid and s.venue_id = p_venue_id and s.is_active
      )
    ) then
      return jsonb_build_object('ok', false, 'message', 'That Event Space does not belong to this venue.');
    end if;
    if v_primary_space is null and coalesce(cardinality(v_space_ids), 0) > 0 then
      v_primary_space := v_space_ids[1];
    end if;
  end if;

  if v_event_id is not null and v_existing_booked_at is not null
     and (
       (not v_confirmed and p_event_date is not null and p_event_date is distinct from v_existing_date)
       or (v_confirmed and v_event_date is distinct from v_existing_date)
     ) then
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
  if not v_confirmed then
    v_event_end := coalesce(p_event_end_date, v_client.end_date);
    if v_event_end is not distinct from v_event_date then
      v_event_end := null;
    end if;
  end if;
  v_booked_on := (timezone(public._venue_scheduling_timezone(p_venue_id), now()))::date;
  v_origin := coalesce(
    p_lifecycle_origin,
    case when v_lead_id is not null then 'pipeline' else 'direct' end
  );

  if v_event_id is not null and v_existing_booked_at is not null then
    v_newly := false;
    -- Already Booked: consume any leftover active holds on the Event date only.
    if v_lead_id is not null and v_existing_date is not null then
      update public.date_holds
        set status = 'converted'
      where venue_id = p_venue_id
        and lead_id = v_lead_id
        and status = 'active'
        and hold_date = v_existing_date;
    end if;
  elsif v_event_id is not null and v_existing_booked_at is null then
    -- Consume own overlapping holds before stamping booked_at (occupancy trigger).
    if v_lead_id is not null and v_event_date is not null then
      v_hold_end := coalesce(v_event_end, v_event_date);
      update public.date_holds
        set status = 'converted'
      where venue_id = p_venue_id
        and lead_id = v_lead_id
        and status = 'active'
        and hold_date >= v_event_date
        and hold_date <= v_hold_end;
    end if;
    update public.events
      set status = 'confirmed',
          booked_at = case when v_confirmed then null else v_booked_on end,
          name = v_name,
          event_type = coalesce(nullif(p_event_type, ''), v_client.event_type),
          event_date = v_event_date,
          event_end_date = v_event_end,
          start_time = case when v_confirmed then v_conf_start else coalesce(p_start_time, v_client.ceremony_time, start_time) end,
          end_time = case when v_confirmed then v_conf_end else coalesce(p_end_time, v_client.reception_time, end_time) end,
          setup_time = coalesce(p_setup_time, setup_time),
          teardown_time = coalesce(p_teardown_time, teardown_time),
          guest_count = coalesce(p_guest_count, v_client.guest_count),
          space_id = case when v_confirmed then v_primary_space else coalesce(p_space_id, space_id) end,
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
      if v_lead_id is not null and v_event_date is not null then
        v_hold_end := coalesce(v_event_end, v_event_date);
        update public.date_holds
          set status = 'converted'
        where venue_id = p_venue_id
          and lead_id = v_lead_id
          and status = 'active'
          and hold_date >= v_event_date
          and hold_date <= v_hold_end;
      end if;
      update public.events
        set status = case when v_confirmed then status else 'confirmed' end,
            name = coalesce(nullif(trim(p_name), ''), name),
            event_type = coalesce(nullif(p_event_type, ''), event_type),
            event_date = case when v_confirmed then v_event_date else coalesce(p_event_date, event_date) end,
            event_end_date = case when v_confirmed then v_event_end else coalesce(p_event_end_date, event_end_date) end,
            start_time = case when v_confirmed then v_conf_start else coalesce(p_start_time, start_time) end,
            end_time = case when v_confirmed then v_conf_end else coalesce(p_end_time, end_time) end,
            setup_time = coalesce(p_setup_time, setup_time),
            teardown_time = coalesce(p_teardown_time, teardown_time),
            guest_count = coalesce(p_guest_count, guest_count),
            space_id = case when v_confirmed then v_primary_space else coalesce(p_space_id, space_id) end
      where id = v_event_id and venue_id = p_venue_id;
      v_newly := false;
    else
      if v_event_date is null then
        return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
      end if;
      if v_lead_id is not null then
        v_hold_end := coalesce(v_event_end, v_event_date);
        update public.date_holds
          set status = 'converted'
        where venue_id = p_venue_id
          and lead_id = v_lead_id
          and status = 'active'
          and hold_date >= v_event_date
          and hold_date <= v_hold_end;
      end if;
      insert into public.events (
        venue_id, client_id, space_id, status, name, event_type,
        event_date, event_end_date, start_time, end_time, setup_time, teardown_time,
        guest_count, booked_at, booking_celebration_pending
      ) values (
        p_venue_id, p_client_id,
        case when v_confirmed then v_primary_space else p_space_id end,
        'confirmed', v_name,
        coalesce(nullif(p_event_type, ''), v_client.event_type),
        v_event_date, v_event_end,
        case when v_confirmed then v_conf_start else coalesce(p_start_time, v_client.ceremony_time) end,
        case when v_confirmed then v_conf_end else coalesce(p_end_time, v_client.reception_time) end,
        p_setup_time, p_teardown_time,
        coalesce(p_guest_count, v_client.guest_count),
        case when v_confirmed then null else v_booked_on end,
        true
      )
      returning id into v_event_id;
      v_newly := true;
    end if;
  end if;

  -- Confirmed occupancy: assignments exist before booked_at so the
  -- occupancy trigger sees the final space set. Failure rolls the hold
  -- conversion back with the rest of this function.
  -- Already-booked rows are not rewritten.
  if v_confirmed and v_existing_booked_at is null then
    delete from public.event_space_assignments
    where event_id = v_event_id and venue_id = p_venue_id;

    insert into public.event_space_assignments (
      venue_id, event_id, use_key, use_label, space_id, sort_order
    )
    select
      p_venue_id,
      v_event_id,
      btrim(a.use_key),
      coalesce(nullif(btrim(a.use_label), ''), initcap(replace(btrim(a.use_key), '_', ' '))),
      a.space_id,
      a.ord::smallint
    from (
      select distinct on (btrim(x.value->>'useKey'))
        btrim(x.value->>'useKey') as use_key,
        x.value->>'useLabel' as use_label,
        nullif(btrim(x.value->>'spaceId'), '')::uuid as space_id,
        x.ord
      from jsonb_array_elements(coalesce(p_confirmed_occupancy->'assignments', '[]'::jsonb))
        with ordinality as x(value, ord)
      where nullif(btrim(x.value->>'useKey'), '') is not null
        and nullif(btrim(x.value->>'spaceId'), '') is not null
      order by btrim(x.value->>'useKey'), x.ord
    ) a
    join public.venue_spaces s
      on s.id = a.space_id and s.venue_id = p_venue_id and s.is_active;

    if not exists (
      select 1 from public.event_space_assignments z where z.event_id = v_event_id
    ) and v_primary_space is not null then
      insert into public.event_space_assignments (
        venue_id, event_id, use_key, use_label, space_id, sort_order
      ) values (
        p_venue_id, v_event_id, 'event_space', 'Event space', v_primary_space, 0
      );
    end if;

    update public.events
      set status = 'confirmed',
          booked_at = coalesce(booked_at, v_booked_on),
          event_date = v_event_date,
          event_end_date = v_event_end,
          start_time = v_conf_start,
          end_time = v_conf_end,
          space_id = v_primary_space
    where id = v_event_id and venue_id = p_venue_id;
  end if;

  update public.clients
    set status = 'confirmed',
        lifecycle_booked_at = coalesce(lifecycle_booked_at, now()),
        lifecycle_booking_origin = coalesce(lifecycle_booking_origin, v_origin)
  where id = p_client_id and venue_id = p_venue_id;
  if not found then
    raise exception 'Client not found.';
  end if;

  if v_lead_id is null then
    v_relationship_id := v_client.relationship_id;
    if v_relationship_id is null then
      v_relationship_id := public.find_or_create_relationship(
        p_venue_id,
        v_client.email,
        v_client.first_name,
        v_client.last_name
      );
    end if;

    select l.id into v_lead_id
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id = v_relationship_id
    order by l.created_at
    limit 1
    for update;

    if v_lead_id is null then
      v_source := null;
      if exists (
        select 1 from public.lead_sources s
        where s.key = 'other' and s.is_enabled
      ) then
        v_source := 'other';
      end if;

      insert into public.leads (
        venue_id, sales_stage, source, first_name, last_name, email, phone,
        partner_first_name, partner_last_name, partner_email,
        event_type, event_date, end_date, guest_count,
        inquiry_date, relationship_id, first_booked_at
      ) values (
        p_venue_id,
        'booked',
        v_source,
        v_client.first_name,
        v_client.last_name,
        v_client.email,
        v_client.phone,
        v_client.partner_first_name,
        v_client.partner_last_name,
        v_client.partner_email,
        coalesce(nullif(p_event_type, ''), v_client.event_type),
        v_event_date,
        v_event_end,
        coalesce(p_guest_count, v_client.guest_count),
        v_booked_on,
        v_relationship_id,
        now()
      )
      returning id into v_lead_id;
    end if;

    update public.clients
      set lead_id = v_lead_id,
          relationship_id = coalesce(relationship_id, v_relationship_id)
    where id = p_client_id and venue_id = p_venue_id;
  end if;

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
  where o.venue_id = p_venue_id and o.client_id = p_client_id and event_id is null
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

  -- Required vendors (venue_vendor_relationships.is_required) → event assignments.
  -- Venue-level rule, not Setup Profile requiredVendorIds. Idempotent. Not a Booked gate.
  if v_newly then
    insert into public.event_vendor_assignments (
      venue_id, event_id, client_id, vendor_id, notes
    )
    select
      p_venue_id,
      v_event_id,
      p_client_id,
      vvr.vendor_id,
      'Required by venue'
    from public.venue_vendor_relationships vvr
    where vvr.venue_id = p_venue_id
      and vvr.is_required = true
      and vvr.status = 'active'
      and not exists (
        select 1 from public.event_vendor_assignments x
        where x.event_id = v_event_id and x.vendor_id = vvr.vendor_id
      );
  end if;

  -- Seed booked-event space authority from historical lead preferences.
  -- Same transaction. Never rewrite lead_event_space_preferences.
  -- Inactive / disallowed / missing spaces are skipped; booking still succeeds.
  if v_newly and v_lead_id is not null and not v_confirmed then
    insert into public.event_space_assignments (
      venue_id, event_id, use_key, use_label, space_id, sort_order
    )
    select
      p_venue_id,
      v_event_id,
      p.use_key,
      case p.use_key
        when 'ceremony' then 'Ceremony'
        when 'reception' then 'Reception'
        when 'cocktail_hour' then 'Cocktail Hour'
        when 'getting_ready' then 'Getting Ready'
        when 'rehearsal_dinner' then 'Rehearsal Dinner'
        else initcap(replace(p.use_key, '_', ' '))
      end,
      p.space_id,
      case p.use_key
        when 'reception' then 0
        when 'ceremony' then 1
        else 10
      end
    from public.lead_event_space_preferences p
    join public.venue_spaces s
      on s.id = p.space_id
     and s.venue_id = p_venue_id
    where p.lead_id = v_lead_id
      and p.venue_id = p_venue_id
      and p.preference_kind = 'venue_space'
      and (
        coalesce(
          (select e.event_type from public.events e where e.id = v_event_id),
          p_event_type,
          ''
        ) in (
          'wedding', 'elopement', 'engagement_party', 'rehearsal_dinner', 'reception'
        )
        or p.use_key not in (
          'ceremony', 'reception', 'getting_ready', 'rehearsal_dinner'
        )
      )
      and p.space_id is not null
      and s.is_active
      and (
        coalesce(cardinality(s.permitted_uses), 0) = 0
        or p.use_key = any (s.permitted_uses)
      )
      and not exists (
        select 1 from public.event_space_assignments a
        where a.event_id = v_event_id and a.use_key = p.use_key
      );

    update public.events e
      set external_ceremony_location = coalesce(
            nullif(trim(e.external_ceremony_location), ''),
            (
              select nullif(trim(p.external_location), '')
              from public.lead_event_space_preferences p
              where p.lead_id = v_lead_id
                and p.venue_id = p_venue_id
                and p.use_key = 'ceremony'
                and p.preference_kind = 'external'
              limit 1
            )
          ),
          external_reception_location = coalesce(
            nullif(trim(e.external_reception_location), ''),
            (
              select nullif(trim(p.external_location), '')
              from public.lead_event_space_preferences p
              where p.lead_id = v_lead_id
                and p.venue_id = p_venue_id
                and p.use_key = 'reception'
                and p.preference_kind = 'external'
              limit 1
            )
          )
    where e.id = v_event_id and e.venue_id = p_venue_id;

    update public.events e
      set space_id = coalesce(
        (select a.space_id from public.event_space_assignments a
          where a.event_id = e.id and a.use_key = 'reception' limit 1),
        (select a.space_id from public.event_space_assignments a
          where a.event_id = e.id and a.use_key = 'ceremony' limit 1),
        (select a.space_id from public.event_space_assignments a
          where a.event_id = e.id order by a.sort_order, a.created_at limit 1)
      )
    where e.id = v_event_id
      and e.venue_id = p_venue_id
      and e.space_id is null
      and exists (
        select 1 from public.event_space_assignments a where a.event_id = e.id
      );
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


revoke all on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text, jsonb) from public;
grant execute on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text, jsonb) to authenticated, service_role;

comment on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text, jsonb) is
  'The only Booked transition. One transaction. When p_confirmed_occupancy is set, that date, end date, times, and spaces are authoritative: own overlapping holds convert, assignments are written, then booked_at is set so occupancy sees the final space set. Failure rolls back the hold conversion. Null occupancy keeps the previous coalesce behavior for Create Event and import.';
