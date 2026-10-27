-- P2 / D5: abort the replace transaction on invalid items so prior inserts
-- in the same call cannot commit (RETURN ok:false does not roll back).

create or replace function public.replace_venue_timeline_from_template_items(
  p_event_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_event_id uuid;
  v_item jsonb;
  v_inserted int := 0;
  v_audiences text[];
  v_title text;
  v_blocked_message text :=
    'This event already has venue timeline items, including items added from the schedule. Replacing the template would remove that work.'
    || E'\n\n'
    || 'To keep your existing items, add items from a template on the Timeline tab instead.'
    || E'\n\n'
    || 'A safer replace option isn’t available yet.';
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Not signed in to a venue.');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.id = p_event_id and e.venue_id = v_venue_id
  for update;

  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found', 'message', 'Event not found.');
  end if;

  perform 1
  from public.timeline_entries te
  where te.event_id = p_event_id
    and te.venue_id = v_venue_id
    and te.owner = 'venue'
  for update;

  if exists (
    select 1
    from public.timeline_entries te
    where te.event_id = p_event_id
      and te.venue_id = v_venue_id
      and te.owner = 'venue'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'venue_owned_entries_exist',
      'message', v_blocked_message
    );
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'nothing_to_apply',
      'message', 'This timeline template has no items yet.'
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_title := nullif(trim(coalesce(v_item->>'title', '')), '');
    if v_title is null then
      -- Must abort the transaction; returning jsonb would keep earlier inserts.
      raise exception 'Every template item needs a title.'
        using errcode = 'check_violation';
    end if;

    if v_item ? 'audiences' and jsonb_typeof(v_item->'audiences') = 'array' then
      select coalesce(array_agg(x), array[]::text[])
      into v_audiences
      from jsonb_array_elements_text(v_item->'audiences') as t(x);
    else
      v_audiences := array['client']::text[];
    end if;

    insert into public.timeline_entries (
      venue_id,
      event_id,
      title,
      description,
      notes,
      entry_time,
      day_offset,
      sort_order,
      audiences,
      owner,
      lock_state,
      status,
      timing_day_intent,
      timing_day_anchor,
      timing_relative_day_offset,
      timing_day_offset_overridden,
      timing_template_day_offset,
      timing_template_day_anchor,
      timing_fixed_date,
      timing_clock_intent,
      timing_relative_minutes,
      timing_clock_overridden,
      timing_attention
    ) values (
      v_venue_id,
      p_event_id,
      v_title,
      nullif(trim(coalesce(v_item->>'description', '')), ''),
      nullif(trim(coalesce(v_item->>'notes', '')), ''),
      case
        when v_item ? 'entry_time' then nullif(v_item->>'entry_time', '')::time
        else null
      end,
      coalesce((v_item->>'day_offset')::int, 0),
      coalesce((v_item->>'sort_order')::int, 0),
      v_audiences,
      'venue',
      coalesce(nullif(v_item->>'lock_state', ''), 'locked'),
      coalesce(nullif(v_item->>'status', ''), 'not_started'),
      nullif(v_item->>'timing_day_intent', ''),
      nullif(v_item->>'timing_day_anchor', ''),
      case when v_item ? 'timing_relative_day_offset'
        then nullif(v_item->>'timing_relative_day_offset', '')::int else null end,
      coalesce((v_item->>'timing_day_offset_overridden')::boolean, false),
      case when v_item ? 'timing_template_day_offset'
        then nullif(v_item->>'timing_template_day_offset', '')::int else null end,
      nullif(v_item->>'timing_template_day_anchor', ''),
      nullif(v_item->>'timing_fixed_date', '')::date,
      nullif(v_item->>'timing_clock_intent', ''),
      case when v_item ? 'timing_relative_minutes'
        then nullif(v_item->>'timing_relative_minutes', '')::int else null end,
      coalesce((v_item->>'timing_clock_overridden')::boolean, false),
      nullif(v_item->>'timing_attention', '')
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'eventId', p_event_id
  );
end;
$$;

grant execute on function public.replace_venue_timeline_from_template_items(uuid, jsonb) to authenticated;
