-- Hold / availability integrity.
--
-- Lost (sales_stage lost) and cancelled booked relationships (sales_stage
-- cancelled) release that lead's still-protecting holds in the same
-- transaction. Elapsed active holds become status expired. Archive does not
-- release holds. Existing expires_at values are not rewritten except when
-- the clock has already passed and the row is still active.
--
-- Assignment replacement re-runs booked occupancy even when primary space_id
-- is unchanged. Rows without booked_at still do not occupy.

alter table public.venues
  add column if not exists hold_blocks_availability boolean not null default true;

create or replace function public.expire_elapsed_date_holds(p_venue_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.date_holds
    set status = 'expired'
  where venue_id = p_venue_id
    and status = 'active'
    and expires_at is not null
    and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_elapsed_date_holds(uuid) is
  'Lazy persist: active holds whose expires_at has passed become status expired. Does not rewrite unexpired timestamps.';

create or replace function public.release_lead_protecting_holds(p_venue_id uuid, p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_lead_id is null then
    return;
  end if;

  update public.date_holds
    set status = 'expired'
  where venue_id = p_venue_id
    and lead_id = p_lead_id
    and status = 'active'
    and expires_at is not null
    and expires_at <= now();

  update public.date_holds
    set status = 'released'
  where venue_id = p_venue_id
    and lead_id = p_lead_id
    and status = 'active'
    and (expires_at is null or expires_at > now());
end;
$$;

comment on function public.release_lead_protecting_holds(uuid, uuid) is
  'Stop this lead''s protecting holds. Elapsed active rows become expired. Unexpired active rows become released. Converted, released, expired, and other leads are untouched. Events are untouched.';

create or replace function public.leads_release_holds_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.sales_stage is distinct from OLD.sales_stage
     and NEW.sales_stage in ('lost', 'cancelled') then
    perform public.release_lead_protecting_holds(NEW.venue_id, NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists leads_release_holds_on_close on public.leads;
create trigger leads_release_holds_on_close
  after update of sales_stage on public.leads
  for each row
  execute function public.leads_release_holds_on_close();

comment on function public.leads_release_holds_on_close() is
  'Atomic with the Lost or cancelled-relationship sales_stage write. Archive does not change sales_stage and does not release holds.';

create or replace function public.events_enforce_availability()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_old_start date;
  v_old_end date;
  v_new_start date;
  v_new_end date;
  v_day date;
  v_extra integer;
  v_occupancy_changed boolean;
  v_restoring boolean;
  v_becoming_booked boolean;
  v_prot_start date;
  v_prot_end date;
  v_block_title text;
  v_win_start time;
  v_win_end time;
  v_max integer;
  v_hold record;
  v_hold_spaces uuid[];
  v_hold_win_start time;
  v_hold_win_end time;
  v_cand_spaces uuid[];
  v_same_owner boolean;
  v_force boolean;
begin
  if NEW.status = 'cancelled' then
    return NEW;
  end if;

  if TG_OP = 'INSERT'
     and NEW.status = 'complete'
     and NEW.event_date < (timezone('utc', now()))::date then
    return NEW;
  end if;

  if NEW.booked_at is null then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    v_occupancy_changed :=
         OLD.event_date is distinct from NEW.event_date
      or OLD.event_end_date is distinct from NEW.event_end_date
      or OLD.setup_time is distinct from NEW.setup_time
      or OLD.start_time is distinct from NEW.start_time
      or OLD.end_time is distinct from NEW.end_time
      or OLD.teardown_time is distinct from NEW.teardown_time
      or OLD.space_id is distinct from NEW.space_id;
    v_restoring := OLD.status = 'cancelled' and NEW.status is distinct from 'cancelled';
    v_becoming_booked := OLD.booked_at is null;
    v_force := coalesce(current_setting('htc.force_event_occupancy', true), '') = '1';
    if not v_occupancy_changed and not v_restoring and not v_becoming_booked and not v_force then
      return NEW;
    end if;

    v_extra := public.event_turnaround_extra_lock_days(NEW.venue_id);
    v_old_start := OLD.event_date - v_extra;
    v_old_end := coalesce(OLD.event_end_date, OLD.event_date) + v_extra;
    if v_old_end < v_old_start then
      v_old_end := v_old_start;
    end if;
    v_new_start := NEW.event_date - v_extra;
    v_new_end := coalesce(NEW.event_end_date, NEW.event_date) + v_extra;
    if v_new_end < v_new_start then
      v_new_end := v_new_start;
    end if;

    for v_day in
      select d from (
        select generate_series(v_old_start, v_old_end, interval '1 day')::date as d
        union
        select generate_series(v_new_start, v_new_end, interval '1 day')
      ) days
      order by d
    loop
      perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext(v_day::text));
    end loop;
  end if;

  v_result := public.assert_event_availability(
    NEW.venue_id,
    NEW.event_date,
    NEW.event_end_date,
    NEW.setup_time,
    NEW.start_time,
    NEW.end_time,
    NEW.teardown_time,
    NEW.space_id,
    case when TG_OP = 'UPDATE' then NEW.id else null end
  );

  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception '%', coalesce(v_result->>'message', 'This date is not available.')
      using errcode = 'P0001',
            detail = v_result::text,
            hint = coalesce(v_result->>'code', 'venue_at_capacity');
  end if;

  perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext('calendar-blocks'));

  v_prot_start := NEW.event_date;
  v_prot_end := coalesce(NEW.event_end_date, NEW.event_date);
  if v_prot_end < v_prot_start then
    v_prot_end := v_prot_start;
  end if;
  select w.window_start, w.window_end
    into v_win_start, v_win_end
  from public.event_operational_window(
    NEW.setup_time, NEW.start_time, NEW.end_time, NEW.teardown_time
  ) w;
  v_block_title := public.covering_calendar_block_title(
    NEW.venue_id, v_prot_start, v_prot_end, v_win_start, v_win_end, null
  );
  if v_block_title is not null then
    raise exception 'Cannot book this date — the calendar is blocked: "%". Remove the block first.', v_block_title
      using errcode = 'P0001',
            hint = 'calendar_blocked';
  end if;

  select coalesce(r.max_simultaneous_events, 1) into v_max
  from public.venue_capacity_rules r
  where r.venue_id = NEW.venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  v_cand_spaces := public.event_occupied_space_ids(
    case when TG_OP = 'UPDATE' then NEW.id else null end,
    NEW.space_id
  );

  if exists (
    select 1 from public.venues v
    where v.id = NEW.venue_id
      and coalesce(v.hold_blocks_availability, true)
  ) then
    for v_hold in
      select h.id, h.lead_id, h.space_id, h.hold_date, h.start_time, h.end_time
      from public.date_holds h
      where h.venue_id = NEW.venue_id
        and h.status = 'active'
        and (h.expires_at is null or h.expires_at > now())
        and h.hold_date >= NEW.event_date
        and h.hold_date <= coalesce(NEW.event_end_date, NEW.event_date)
    loop
      v_same_owner := false;
      if v_hold.lead_id is not null and NEW.client_id is not null then
        select exists (
          select 1 from public.clients c
          where c.id = NEW.client_id
            and c.venue_id = NEW.venue_id
            and c.lead_id = v_hold.lead_id
        ) into v_same_owner;
      end if;
      if v_same_owner then
        continue;
      end if;

      select w.window_start, w.window_end
        into v_hold_win_start, v_hold_win_end
      from public.event_operational_window(null, v_hold.start_time, v_hold.end_time, null) w;

      if not (v_win_start < v_hold_win_end and v_hold_win_start < v_win_end) then
        continue;
      end if;

      v_hold_spaces := public.hold_occupied_space_ids(v_hold.id, v_hold.space_id);
      if public.hold_resources_collide(v_hold_spaces, v_cand_spaces, v_max) then
        raise exception 'This date has a hold. Your availability settings treat holds as unavailable.'
          using errcode = 'P0001',
                hint = 'hold_blocks';
      end if;
    end loop;
  end if;

  return NEW;
end;
$$;



comment on function public.events_enforce_availability() is
  'Booked events enforce occupancy (including event_space_assignments), calendar blocks, and foreign active unexpired holds. htc.force_event_occupancy=1 rechecks a booked row when assignments change but primary space_id does not. Rows without booked_at do not occupy.';

-- Same-value space_id writes must still enter the function so an assignment
-- replace can force a recheck. The function returns immediately unless
-- occupancy actually changed, the row is being booked/restored, or the
-- force flag is set.
drop trigger if exists events_enforce_availability_upd on public.events;
create trigger events_enforce_availability_upd
  before update of event_date, event_end_date, setup_time, start_time, end_time, teardown_time, space_id, status, booked_at
  on public.events
  for each row
  execute function public.events_enforce_availability();

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

  delete from public.event_space_assignments
  where event_id = p_event_id and venue_id = p_venue_id;

  insert into public.event_space_assignments (
    venue_id, event_id, use_key, use_label, space_id, sort_order
  )
  select
    p_venue_id,
    p_event_id,
    btrim(a.use_key),
    coalesce(nullif(btrim(a.use_label), ''), initcap(replace(btrim(a.use_key), '_', ' '))),
    a.space_id,
    a.sort_order::smallint
  from (
    select
      x.value->>'useKey' as use_key,
      x.value->>'useLabel' as use_label,
      nullif(btrim(x.value->>'spaceId'), '')::uuid as space_id,
      coalesce((x.value->>'sortOrder')::integer, (x.ord - 1)::integer) as sort_order
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) with ordinality as x(value, ord)
  ) a
  join public.venue_spaces s
    on s.id = a.space_id and s.venue_id = p_venue_id and s.is_active
  where nullif(btrim(a.use_key), '') is not null
    and a.space_id is not null;

  perform set_config('htc.force_event_occupancy', '1', true);
  update public.events
    set space_id = p_primary_space_id
  where id = p_event_id and venue_id = p_venue_id;
  perform set_config('htc.force_event_occupancy', '', true);
end;
$$;

comment on function public.replace_event_space_assignments(uuid, uuid, uuid, jsonb) is
  'Replace an event''s space assignments and re-run booked occupancy for the complete set, including when the primary space does not change.';

revoke all on function public.expire_elapsed_date_holds(uuid) from public;
revoke all on function public.release_lead_protecting_holds(uuid, uuid) from public;
revoke all on function public.replace_event_space_assignments(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.expire_elapsed_date_holds(uuid) to authenticated, service_role;
grant execute on function public.release_lead_protecting_holds(uuid, uuid) to authenticated, service_role;
grant execute on function public.replace_event_space_assignments(uuid, uuid, uuid, jsonb) to authenticated, service_role;
