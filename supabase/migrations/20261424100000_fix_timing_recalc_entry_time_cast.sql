-- P1c fix: entry_time CASE must cast jsonb text to time (not mix time/text).

create or replace function public.apply_venue_timeline_timing_recalc(
  p_event_id uuid,
  p_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_update jsonb;
  v_id uuid;
  v_applied int := 0;
  v_owner text;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Not signed in to a venue.');
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.venue_id = v_venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'event_not_found', 'message', 'Event not found.');
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_updates', 'message', 'No timeline updates provided.');
  end if;

  perform 1
  from public.timeline_entries te
  where te.event_id = p_event_id
    and te.venue_id = v_venue_id
    and te.owner = 'venue'
  for update;

  for v_update in select value from jsonb_array_elements(p_updates)
  loop
    v_id := nullif(v_update->>'id', '')::uuid;
    if v_id is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_updates', 'message', 'Every update needs an item id.');
    end if;

    select te.owner into v_owner
    from public.timeline_entries te
    where te.id = v_id
      and te.event_id = p_event_id
      and te.venue_id = v_venue_id
    for update;

    if v_owner is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'stale_preview',
        'message', 'A timeline item changed since you reviewed this list. Review again before applying.'
      );
    end if;
    if v_owner <> 'venue' then
      return jsonb_build_object(
        'ok', false,
        'error', 'forbidden',
        'message', 'Couple-owned timeline items are not recalculated here.'
      );
    end if;

    update public.timeline_entries te
    set
      day_offset = coalesce((v_update->>'day_offset')::int, te.day_offset),
      entry_time = case
        when v_update ? 'entry_time' then nullif(v_update->>'entry_time', '')::time
        else te.entry_time
      end,
      timing_day_intent = case
        when v_update ? 'timing_day_intent' then nullif(v_update->>'timing_day_intent', '')
        else te.timing_day_intent
      end,
      timing_day_anchor = case
        when v_update ? 'timing_day_anchor' then nullif(v_update->>'timing_day_anchor', '')
        else te.timing_day_anchor
      end,
      timing_relative_day_offset = case
        when v_update ? 'timing_relative_day_offset' then (v_update->>'timing_relative_day_offset')::int
        else te.timing_relative_day_offset
      end,
      timing_day_offset_overridden = case
        when v_update ? 'timing_day_offset_overridden' then (v_update->>'timing_day_offset_overridden')::boolean
        else te.timing_day_offset_overridden
      end,
      timing_template_day_offset = case
        when v_update ? 'timing_template_day_offset' then (v_update->>'timing_template_day_offset')::int
        else te.timing_template_day_offset
      end,
      timing_template_day_anchor = case
        when v_update ? 'timing_template_day_anchor' then nullif(v_update->>'timing_template_day_anchor', '')
        else te.timing_template_day_anchor
      end,
      timing_fixed_date = case
        when v_update ? 'timing_fixed_date' then nullif(v_update->>'timing_fixed_date', '')::date
        else te.timing_fixed_date
      end,
      timing_clock_intent = case
        when v_update ? 'timing_clock_intent' then nullif(v_update->>'timing_clock_intent', '')
        else te.timing_clock_intent
      end,
      timing_relative_minutes = case
        when v_update ? 'timing_relative_minutes' then (v_update->>'timing_relative_minutes')::int
        else te.timing_relative_minutes
      end,
      timing_clock_overridden = case
        when v_update ? 'timing_clock_overridden' then (v_update->>'timing_clock_overridden')::boolean
        else te.timing_clock_overridden
      end,
      timing_attention = case
        when v_update ? 'timing_attention' then nullif(v_update->>'timing_attention', '')
        else te.timing_attention
      end,
      updated_at = now()
    where te.id = v_id
      and te.event_id = p_event_id
      and te.venue_id = v_venue_id
      and te.owner = 'venue';

    if found then
      v_applied := v_applied + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'applied', v_applied);
end;
$$;

revoke all on function public.apply_venue_timeline_timing_recalc(uuid, jsonb) from public;
grant execute on function public.apply_venue_timeline_timing_recalc(uuid, jsonb) to authenticated;
