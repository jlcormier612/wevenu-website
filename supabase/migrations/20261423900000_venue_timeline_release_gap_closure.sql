-- Timeline P1b gap closure:
-- 1) Preview reports workingAheadOfRelease via fingerprint compare.
-- 2) Confirm locks working rows; re-checks fingerprint after snapshot.
-- 3) Sandbox mid-txn fault (GUC) after insert / before pointer — rolls back.
-- Fault wrapper is service_role only; ordinary confirm never arms the GUC.

create or replace function public.preview_venue_timeline_release(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_event record;
  v_last jsonb := '[]'::jsonb;
  v_last_ids uuid[] := array[]::uuid[];
  v_will_share jsonb := '[]'::jsonb;
  v_held_out jsonb := '[]'::jsonb;
  v_blocks jsonb := '[]'::jsonb;
  v_soft jsonb := '[]'::jsonb;
  v_entry record;
  v_unresolved boolean;
  v_in_last boolean;
  v_fp text;
  v_released_at timestamptz;
  v_last_fp text;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id, e.venue_id, e.event_date, e.event_end_date, e.active_venue_timeline_release_id
  into v_event
  from public.events e
  where e.id = p_event_id and e.venue_id = v_venue_id;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  if v_event.active_venue_timeline_release_id is not null then
    select r.snapshot, r.released_at, r.working_fingerprint
    into v_last, v_released_at, v_last_fp
    from public.venue_timeline_releases r
    where r.id = v_event.active_venue_timeline_release_id
      and r.venue_id = v_venue_id
      and r.event_id = p_event_id;
    select coalesce(array_agg((item->>'id')::uuid), array[]::uuid[])
    into v_last_ids
    from jsonb_array_elements(coalesce(v_last, '[]'::jsonb)) item;
  end if;

  for v_entry in
    select te.*
    from public.timeline_entries te
    where te.venue_id = v_venue_id
      and te.event_id = p_event_id
      and te.owner = 'venue'
    order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
  loop
    v_unresolved := public._timeline_entry_is_unresolved(v_entry.timing_attention);
    v_in_last := v_entry.id = any(v_last_ids);

    if v_unresolved and v_in_last then
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title,
        'reason', 'previously_released_unresolved', 'attention', v_entry.timing_attention
      ));
    elsif v_unresolved and not v_in_last then
      v_held_out := v_held_out || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title,
        'reason', 'never_released_unresolved', 'attention', v_entry.timing_attention
      ));
    else
      v_will_share := v_will_share || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title,
        'dayOffset', coalesce(v_entry.day_offset, 0),
        'entryTime', v_entry.entry_time, 'attention', v_entry.timing_attention
      ));
    end if;

    if v_entry.timing_day_intent = 'fixed'
      and public._timeline_fixed_outside_pad(v_event.event_date, v_entry.timing_fixed_date)
    then
      v_soft := v_soft || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title,
        'reason', 'fixed_outside_planning_pad', 'fixedDate', v_entry.timing_fixed_date
      ));
    end if;
  end loop;

  v_fp := public._venue_timeline_working_fingerprint(v_venue_id, p_event_id);

  return jsonb_build_object(
    'ok', true,
    'eventId', p_event_id,
    'willShare', v_will_share,
    'heldOut', v_held_out,
    'blocksRelease', v_blocks,
    'softWarnings', v_soft,
    'canRelease', jsonb_array_length(v_blocks) = 0 and jsonb_array_length(v_will_share) > 0,
    'lastReleasedAt', v_released_at,
    'workingFingerprint', v_fp,
    'lastWorkingFingerprint', v_last_fp,
    'workingAheadOfRelease',
      v_event.active_venue_timeline_release_id is not null
      and v_fp is distinct from v_last_fp,
    'hasPriorRelease', v_event.active_venue_timeline_release_id is not null
  );
end;
$$;

grant execute on function public.preview_venue_timeline_release(uuid) to authenticated;

create or replace function public._confirm_venue_timeline_release_for_venue(
  p_venue_id uuid,
  p_event_id uuid,
  p_acknowledged_hold_out_ids uuid[],
  p_working_fingerprint text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_last_ids uuid[] := array[]::uuid[];
  v_will jsonb := '[]'::jsonb;
  v_held jsonb := '[]'::jsonb;
  v_blocks jsonb := '[]'::jsonb;
  v_ack uuid[] := coalesce(p_acknowledged_hold_out_ids, array[]::uuid[]);
  v_expected_hold uuid[];
  v_snapshot jsonb := '[]'::jsonb;
  v_held_meta jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_release_id uuid;
  v_fp text;
  v_fp_after text;
  v_entry record;
  v_existing uuid;
  v_prev_release uuid;
  v_unresolved boolean;
  v_in_last boolean;
begin
  if p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id, e.venue_id, e.event_date, e.event_end_date, e.active_venue_timeline_release_id
  into v_event
  from public.events e
  where e.id = p_event_id and e.venue_id = p_venue_id
  for update;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  v_prev_release := v_event.active_venue_timeline_release_id;

  perform 1
  from public.timeline_entries te
  where te.venue_id = p_venue_id
    and te.event_id = p_event_id
    and te.owner = 'venue'
  for update;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select r.id into v_existing
    from public.venue_timeline_releases r
    where r.event_id = p_event_id
      and r.venue_id = p_venue_id
      and r.idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'releaseId', v_existing,
        'idempotentReplay', true
      );
    end if;
  end if;

  v_fp := public._venue_timeline_working_fingerprint(p_venue_id, p_event_id);
  if p_working_fingerprint is null or p_working_fingerprint is distinct from v_fp then
    return jsonb_build_object(
      'ok', false,
      'error', 'stale_preview',
      'message', 'The working timeline changed since you reviewed the preview. Review again before sharing.'
    );
  end if;

  if v_prev_release is not null then
    select coalesce(array_agg((item->>'id')::uuid), array[]::uuid[])
    into v_last_ids
    from public.venue_timeline_releases r,
         jsonb_array_elements(coalesce(r.snapshot, '[]'::jsonb)) item
    where r.id = v_prev_release
      and r.venue_id = p_venue_id
      and r.event_id = p_event_id;
  end if;

  for v_entry in
    select te.*
    from public.timeline_entries te
    where te.venue_id = p_venue_id
      and te.event_id = p_event_id
      and te.owner = 'venue'
    order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
  loop
    v_unresolved := public._timeline_entry_is_unresolved(v_entry.timing_attention);
    v_in_last := v_entry.id = any(v_last_ids);
    if v_unresolved and v_in_last then
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title,
        'reason', 'previously_released_unresolved', 'attention', v_entry.timing_attention
      ));
    elsif v_unresolved and not v_in_last then
      v_held := v_held || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title,
        'reason', 'never_released_unresolved', 'attention', v_entry.timing_attention
      ));
    else
      v_will := v_will || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id, 'title', v_entry.title
      ));
    end if;
  end loop;

  if jsonb_array_length(v_blocks) > 0 then
    return jsonb_build_object(
      'ok', false, 'error', 'blocks_release', 'blocksRelease', v_blocks,
      'message', 'Fix or replace items already on the shared timeline before sharing again.'
    );
  end if;

  if jsonb_array_length(v_will) = 0 then
    return jsonb_build_object(
      'ok', false, 'error', 'nothing_to_share',
      'message', 'Add resolved timeline items before sharing with the couple.'
    );
  end if;

  select coalesce(array_agg((h->>'id')::uuid), array[]::uuid[])
  into v_expected_hold
  from jsonb_array_elements(v_held) h;

  if exists (select 1 from unnest(v_expected_hold) x where not (x = any(v_ack)))
     or exists (select 1 from unnest(v_ack) x where not (x = any(v_expected_hold)))
  then
    return jsonb_build_object(
      'ok', false, 'error', 'hold_out_ack_required', 'heldOut', v_held,
      'message', 'Confirm the items that will not be shared yet before continuing.'
    );
  end if;

  v_held_meta := v_held;

  for v_entry in
    select te.*
    from public.timeline_entries te
    where te.venue_id = p_venue_id
      and te.event_id = p_event_id
      and te.owner = 'venue'
      and te.id in (select (w->>'id')::uuid from jsonb_array_elements(v_will) w)
    order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
  loop
    v_snapshot := v_snapshot || jsonb_build_array(
      public._venue_timeline_entry_release_json(v_entry.id, p_venue_id)
    );
    v_count := v_count + 1;
  end loop;

  v_fp_after := public._venue_timeline_working_fingerprint(p_venue_id, p_event_id);
  if v_fp_after is distinct from v_fp then
    return jsonb_build_object(
      'ok', false, 'error', 'stale_preview',
      'message', 'The working timeline changed since you reviewed the preview. Review again before sharing.'
    );
  end if;

  begin
    insert into public.venue_timeline_releases (
      venue_id, event_id, snapshot, entry_count, held_out, source,
      idempotency_key, working_fingerprint
    ) values (
      p_venue_id, p_event_id, v_snapshot, v_count, v_held_meta, 'release',
      nullif(trim(coalesce(p_idempotency_key, '')), ''), v_fp
    )
    returning id into v_release_id;
  exception
    when unique_violation then
      if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
        select r.id into v_existing
        from public.venue_timeline_releases r
        where r.event_id = p_event_id and r.venue_id = p_venue_id
          and r.idempotency_key = p_idempotency_key;
        if v_existing is not null then
          return jsonb_build_object('ok', true, 'releaseId', v_existing, 'idempotentReplay', true);
        end if;
      end if;
      return jsonb_build_object(
        'ok', false, 'error', 'release_conflict',
        'message', 'Sharing didn''t finish. The couple still has the previous shared timeline.'
      );
  end;

  if current_setting('htc.venue_timeline_release_force_fail', true) = 'on' then
    raise exception 'SANDBOX_VENUE_TIMELINE_RELEASE_FORCE_FAIL after insert before pointer';
  end if;

  update public.events
  set active_venue_timeline_release_id = v_release_id
  where id = p_event_id and venue_id = p_venue_id;

  return jsonb_build_object(
    'ok', true,
    'releaseId', v_release_id,
    'entryCount', v_count,
    'heldOutCount', jsonb_array_length(v_held_meta),
    'releasedAt', now(),
    'idempotentReplay', false,
    'priorReleaseId', v_prev_release
  );
end;
$$;

revoke all on function public._confirm_venue_timeline_release_for_venue(uuid, uuid, uuid[], text, text) from public;

create or replace function public.confirm_venue_timeline_release(
  p_event_id uuid,
  p_acknowledged_hold_out_ids uuid[],
  p_working_fingerprint text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  return public._confirm_venue_timeline_release_for_venue(
    v_venue_id, p_event_id, p_acknowledged_hold_out_ids, p_working_fingerprint, p_idempotency_key
  );
end;
$$;

grant execute on function public.confirm_venue_timeline_release(uuid, uuid[], text, text) to authenticated;

create or replace function public.confirm_venue_timeline_release_sandbox_fault(
  p_event_id uuid,
  p_acknowledged_hold_out_ids uuid[],
  p_working_fingerprint text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select e.venue_id into v_venue_id from public.events e where e.id = p_event_id;
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;
  perform set_config('htc.venue_timeline_release_force_fail', 'on', true);
  return public._confirm_venue_timeline_release_for_venue(
    v_venue_id, p_event_id, p_acknowledged_hold_out_ids, p_working_fingerprint, p_idempotency_key
  );
end;
$$;

revoke all on function public.confirm_venue_timeline_release_sandbox_fault(uuid, uuid[], text, text) from public;
grant execute on function public.confirm_venue_timeline_release_sandbox_fault(uuid, uuid[], text, text) to service_role;
