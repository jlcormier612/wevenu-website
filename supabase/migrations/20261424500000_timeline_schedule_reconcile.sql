-- Atomic booked-schedule → timeline reconciliation.
-- Plans from the current event_space_assignments after locking the event row
-- (same order as Overview replace). Client-supplied plans are not accepted.
-- Updates never clear source_space_use_key. Detach is an explicit op for locked rows.

drop function if exists public.reconcile_timeline_from_schedule(uuid, uuid, jsonb, jsonb, uuid[], uuid[]);

create or replace function public.reconcile_timeline_from_schedule(
  p_venue_id uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event_date date;
  v_event_end_date date;
  v_upserted int := 0;
  v_deleted int := 0;
  v_detached int := 0;
  v_skipped_locked int := 0;
  v_use_key text;
  v_title text;
  v_description text;
  v_entry_time time;
  v_end_time time;
  v_day_offset int;
  v_sort_order int;
  v_existing_id uuid;
  v_lock_state text;
  v_cur_day_offset int;
  v_cur_entry_time time;
  v_day_intent text;
  v_day_anchor text;
  v_clock_intent text;
  v_decided_day int;
  v_decided_time time;
  v_timing_relative_day_offset int;
  v_timing_day_offset_overridden boolean;
  v_timing_clock_overridden boolean;
  v_timing_relative_minutes int;
  v_timing_clock_intent text;
  v_active_keys text[] := array[]::text[];
  r record;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  select e.id, e.event_date, e.event_end_date
  into v_event_id, v_event_date, v_event_end_date
  from public.events e
  where e.id = p_event_id and e.venue_id = p_venue_id
  for update;

  if v_event_id is null then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;

  -- Serialize against other timeline writers on this event's generated rows.
  perform 1
  from public.timeline_entries te
  where te.event_id = p_event_id
    and te.venue_id = p_venue_id
    and te.owner = 'venue'
    and te.source_space_use_key is not null
  for update;

  for r in
    select
      btrim(a.use_key) as use_key,
      coalesce(nullif(btrim(a.use_label), ''), btrim(a.use_key)) as use_label,
      a.start_time,
      a.end_time,
      a.scheduled_date,
      coalesce(a.sort_order, 0)::int as sort_order,
      nullif(btrim(s.name), '') as space_name
    from public.event_space_assignments a
    left join public.venue_spaces s
      on s.id = a.space_id and s.venue_id = a.venue_id
    where a.event_id = p_event_id
      and a.venue_id = p_venue_id
      and nullif(btrim(a.use_key), '') is not null
      and a.start_time is not null
      and a.scheduled_date is not null
      and v_event_date is not null
    order by a.sort_order nulls last, a.use_key
  loop
    v_use_key := r.use_key;
    v_active_keys := array_append(v_active_keys, v_use_key);
    v_title := r.use_label;
    v_description := case when r.space_name is not null then 'Space: ' || r.space_name else null end;
    v_entry_time := r.start_time;
    v_end_time := r.end_time;
    v_day_offset := public.timeline_clamp_day_offset(
      p_event_id,
      (r.scheduled_date - v_event_date)
    );
    v_sort_order := r.sort_order;

    select te.id, te.lock_state, te.day_offset, te.entry_time,
           te.timing_day_intent, te.timing_day_anchor, te.timing_clock_intent
    into v_existing_id, v_lock_state, v_cur_day_offset, v_cur_entry_time,
         v_day_intent, v_day_anchor, v_clock_intent
    from public.timeline_entries te
    where te.event_id = p_event_id
      and te.venue_id = p_venue_id
      and te.owner = 'venue'
      and te.source_space_use_key = v_use_key
    limit 1;

    if v_existing_id is not null then
      if v_lock_state = 'locked' then
        v_skipped_locked := v_skipped_locked + 1;
      else
        -- Port of scheduleSyncWriteForExistingRow / timingColumnsForUntypedDisplaySave.
        v_decided_day := v_day_offset;
        v_decided_time := v_entry_time;
        v_timing_relative_day_offset := null;
        v_timing_day_offset_overridden := null;
        v_timing_clock_overridden := null;
        v_timing_relative_minutes := null;
        v_timing_clock_intent := null;

        if v_day_intent = 'fixed'
           or (v_day_intent = 'relative' and v_day_anchor = 'event_end') then
          v_decided_day := coalesce(v_cur_day_offset, v_day_offset);
        elsif v_day_intent = 'relative'
              and v_day_anchor = 'event_start'
              and v_day_offset is distinct from coalesce(v_cur_day_offset, 0) then
          v_timing_relative_day_offset := v_day_offset;
          v_timing_day_offset_overridden := true;
        end if;

        if v_clock_intent = 'relative'
           and v_entry_time is distinct from v_cur_entry_time then
          v_timing_clock_overridden := true;
          v_timing_relative_minutes := null;
          v_timing_clock_intent := case when v_entry_time is null then 'untimed' else 'explicit' end;
        elsif v_clock_intent in ('explicit', 'untimed')
              and v_entry_time is distinct from v_cur_entry_time then
          v_timing_clock_overridden := true;
          v_timing_relative_minutes := null;
          v_timing_clock_intent := case when v_entry_time is null then 'untimed' else 'explicit' end;
        end if;

        update public.timeline_entries te
        set
          title = v_title,
          description = v_description,
          entry_time = v_decided_time,
          end_time = v_end_time,
          day_offset = v_decided_day,
          sort_order = v_sort_order,
          timing_relative_day_offset = case
            when v_timing_relative_day_offset is not null then v_timing_relative_day_offset
            else te.timing_relative_day_offset end,
          timing_day_offset_overridden = case
            when v_timing_day_offset_overridden is not null then v_timing_day_offset_overridden
            else te.timing_day_offset_overridden end,
          timing_clock_overridden = case
            when v_timing_clock_overridden is not null then v_timing_clock_overridden
            else te.timing_clock_overridden end,
          timing_relative_minutes = case
            when v_timing_clock_overridden is not null then v_timing_relative_minutes
            else te.timing_relative_minutes end,
          timing_clock_intent = case
            when v_timing_clock_intent is not null then v_timing_clock_intent
            else te.timing_clock_intent end
        where te.id = v_existing_id
          and te.venue_id = p_venue_id
          and te.event_id = p_event_id
          and te.owner = 'venue'
          and te.source_space_use_key is not null
          and te.lock_state is distinct from 'locked';

        if found then
          v_upserted := v_upserted + 1;
        end if;
      end if;
    else
      insert into public.timeline_entries (
        venue_id,
        event_id,
        title,
        description,
        entry_time,
        end_time,
        day_offset,
        sort_order,
        source_space_use_key,
        owner,
        lock_state,
        audiences,
        status
      ) values (
        p_venue_id,
        p_event_id,
        v_title,
        v_description,
        v_entry_time,
        v_end_time,
        v_day_offset,
        v_sort_order,
        v_use_key,
        'venue',
        'editable',
        array['client']::text[],
        'not_started'
      );
      v_upserted := v_upserted + 1;
    end if;
  end loop;

  -- Locked generated rows whose component left the schedule — retain, clear the link.
  update public.timeline_entries te
  set source_space_use_key = null
  where te.event_id = p_event_id
    and te.venue_id = p_venue_id
    and te.owner = 'venue'
    and te.source_space_use_key is not null
    and te.lock_state = 'locked'
    and not (te.source_space_use_key = any (v_active_keys));
  get diagnostics v_detached = row_count;

  -- Unlocked generated rows whose component left the schedule — delete.
  delete from public.timeline_entries te
  where te.event_id = p_event_id
    and te.venue_id = p_venue_id
    and te.owner = 'venue'
    and te.source_space_use_key is not null
    and te.lock_state is distinct from 'locked'
    and not (te.source_space_use_key = any (v_active_keys));
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'upserted', v_upserted,
    'deleted', v_deleted,
    'detached', v_detached,
    'skippedLocked', v_skipped_locked
  );
end;
$$;

revoke all on function public.reconcile_timeline_from_schedule(uuid, uuid) from public;
grant execute on function public.reconcile_timeline_from_schedule(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
