-- Enforce venue_spaces.permitted_uses on replace_event_space_assignments.
-- UI already filters via spacesEligibleForUse; the RPC previously joined only
-- on active venue membership and silently accepted disallowed uses.
-- Empty permitted_uses remains unrestricted (column comment / existing UI rule).
-- Validate before DELETE so a refusal never clears existing assignments.

create or replace function public.replace_event_space_assignments(
  p_venue_id uuid,
  p_event_id uuid,
  p_primary_space_id uuid,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_row record;
  v_space record;
  v_use_label text;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.id = p_event_id and e.venue_id = p_venue_id
  for update;
  if v_event_id is null then
    raise exception 'Event not found.';
  end if;

  -- Refuse invalid rows before mutating so partial/cleared state cannot persist.
  for v_row in
    select
      nullif(btrim(x.value->>'useKey'), '') as use_key,
      nullif(btrim(x.value->>'useLabel'), '') as use_label,
      nullif(btrim(x.value->>'spaceId'), '')::uuid as space_id
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) as x(value)
  loop
    if v_row.use_key is null or v_row.space_id is null then
      continue;
    end if;

    select s.id, s.name, s.is_active, s.permitted_uses
      into v_space
    from public.venue_spaces s
    where s.id = v_row.space_id and s.venue_id = p_venue_id;

    if v_space.id is null then
      raise exception 'That Event Space does not belong to this venue.'
        using errcode = 'P0001', hint = 'invalid_space';
    end if;

    if not v_space.is_active then
      raise exception 'That Event Space is inactive.'
        using errcode = 'P0001', hint = 'invalid_space';
    end if;

    if coalesce(cardinality(v_space.permitted_uses), 0) > 0
       and not (v_row.use_key = any (v_space.permitted_uses)) then
      v_use_label := coalesce(
        v_row.use_label,
        initcap(replace(v_row.use_key, '_', ' '))
      );
      raise exception
        '% cannot be used for %. Choose a space that allows this use, or update the space’s permitted uses in Availability settings.',
        coalesce(nullif(btrim(v_space.name), ''), 'This space'),
        v_use_label
        using errcode = 'P0001', hint = 'permitted_use';
    end if;
  end loop;

  delete from public.event_space_assignments
  where event_id = p_event_id and venue_id = p_venue_id;

  insert into public.event_space_assignments (
    venue_id, event_id, use_key, use_label, space_id, sort_order, start_time, end_time, scheduled_date
  )
  select
    p_venue_id,
    p_event_id,
    btrim(a.use_key),
    coalesce(nullif(btrim(a.use_label), ''), initcap(replace(btrim(a.use_key), '_', ' '))),
    a.space_id,
    a.sort_order::smallint,
    a.start_time,
    a.end_time,
    a.scheduled_date
  from (
    select
      x.value->>'useKey' as use_key,
      x.value->>'useLabel' as use_label,
      nullif(btrim(x.value->>'spaceId'), '')::uuid as space_id,
      coalesce((x.value->>'sortOrder')::integer, (x.ord - 1)::integer) as sort_order,
      nullif(btrim(x.value->>'startTime'), '')::time as start_time,
      nullif(btrim(x.value->>'endTime'), '')::time as end_time,
      nullif(btrim(x.value->>'scheduledDate'), '')::date as scheduled_date
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) with ordinality as x(value, ord)
  ) a
  join public.venue_spaces s
    on s.id = a.space_id and s.venue_id = p_venue_id and s.is_active
  where nullif(btrim(a.use_key), '') is not null
    and a.space_id is not null
    and (
      coalesce(cardinality(s.permitted_uses), 0) = 0
      or btrim(a.use_key) = any (s.permitted_uses)
    );

  perform set_config('htc.force_event_occupancy', '1', true);
  update public.events
    set space_id = p_primary_space_id
  where id = p_event_id and venue_id = p_venue_id;
  perform set_config('htc.force_event_occupancy', '', true);
end;
$$;

comment on function public.replace_event_space_assignments(uuid, uuid, uuid, jsonb) is
  'Replace an event''s space assignments (enforcing venue_spaces.permitted_uses) and re-run booked occupancy for the complete set, including when the primary space does not change.';
