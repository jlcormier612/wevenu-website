-- RESEND-SCALE residual: clamp retry_after_ms so far-future / malformed
-- acquired_at_ms rows cannot overflow Postgres integer (::integer) and fail
-- the entire acquire RPC (which would fail-closed block all sends).
--
-- Does NOT change sliding-window grant/deny semantics, capacity caps, or
-- normal retry timing for in-window wall-clock events.
-- Forward-only: does not edit 20270201120000_resend_global_pacing.sql.

create or replace function public.acquire_resend_send_slot(
  p_priority text,
  p_max_total integer default 9,
  p_max_bulk integer default 6,
  p_window_ms integer default 1000,
  p_now_ms bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ms bigint;
  v_window_ms integer;
  v_start_ms bigint;
  v_critical integer;
  v_bulk integer;
  v_total integer;
  v_oldest_ms bigint;
  v_retry_ms integer;
  v_retry_calc bigint;
  v_priority text;
  -- Postgres integer max — keep retry_after_ms JSON-safe for all clients.
  v_retry_cap constant bigint := 2147483647;
begin
  v_priority := lower(coalesce(p_priority, 'bulk'));
  if v_priority not in ('critical', 'bulk') then
    v_priority := 'bulk';
  end if;

  if p_max_total is null or p_max_total < 1 then
    p_max_total := 9;
  end if;
  if p_max_bulk is null or p_max_bulk < 0 then
    p_max_bulk := 6;
  end if;
  if p_max_bulk > p_max_total then
    p_max_bulk := p_max_total;
  end if;

  v_window_ms := coalesce(nullif(p_window_ms, 0), 1000);
  if v_window_ms < 1 then
    v_window_ms := 1000;
  end if;

  v_now_ms := coalesce(p_now_ms, (extract(epoch from clock_timestamp()) * 1000)::bigint);
  v_start_ms := v_now_ms - v_window_ms;

  perform pg_advisory_xact_lock(hashtext('htc_resend_send_pacing'));

  -- Prune aged lookback rows and clearly-future malformed stamps (cannot
  -- permanently block capacity; does not expand the 9/6 policy).
  delete from public.resend_send_events
  where acquired_at_ms <= v_now_ms - (v_window_ms * 2)
     or acquired_at_ms > v_now_ms + v_window_ms;

  select
    coalesce(sum(case when priority = 'critical' then 1 else 0 end), 0),
    coalesce(sum(case when priority = 'bulk' then 1 else 0 end), 0),
    min(acquired_at_ms)
  into v_critical, v_bulk, v_oldest_ms
  from public.resend_send_events
  where acquired_at_ms > v_start_ms
    and acquired_at_ms <= v_now_ms + v_window_ms;

  v_total := v_critical + v_bulk;
  if v_oldest_ms is null then
    v_retry_ms := 1;
  else
    -- Compute in bigint, then clamp before casting to integer.
    v_retry_calc := v_oldest_ms + v_window_ms - v_now_ms + 1;
    if v_retry_calc < 1 then
      v_retry_ms := 1;
    elsif v_retry_calc > v_retry_cap then
      v_retry_ms := v_retry_cap::integer;
    else
      v_retry_ms := v_retry_calc::integer;
    end if;
  end if;

  if v_priority = 'bulk' then
    if v_bulk >= p_max_bulk then
      return jsonb_build_object(
        'granted', false,
        'at_ms', v_now_ms,
        'critical_count', v_critical,
        'bulk_count', v_bulk,
        'total', v_total,
        'retry_after_ms', v_retry_ms,
        'reason', 'bulk_cap'
      );
    end if;
    if v_total >= p_max_total then
      return jsonb_build_object(
        'granted', false,
        'at_ms', v_now_ms,
        'critical_count', v_critical,
        'bulk_count', v_bulk,
        'total', v_total,
        'retry_after_ms', v_retry_ms,
        'reason', 'window_full'
      );
    end if;
  else
    if v_total >= p_max_total then
      return jsonb_build_object(
        'granted', false,
        'at_ms', v_now_ms,
        'critical_count', v_critical,
        'bulk_count', v_bulk,
        'total', v_total,
        'retry_after_ms', v_retry_ms,
        'reason', 'window_full'
      );
    end if;
  end if;

  insert into public.resend_send_events (acquired_at_ms, priority)
  values (v_now_ms, v_priority);

  if v_priority = 'bulk' then
    v_bulk := v_bulk + 1;
  else
    v_critical := v_critical + 1;
  end if;

  return jsonb_build_object(
    'granted', true,
    'at_ms', v_now_ms,
    'critical_count', v_critical,
    'bulk_count', v_bulk,
    'total', v_critical + v_bulk,
    'retry_after_ms', 0,
    'reason', null
  );
end;
$$;

revoke all on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) from public;
grant execute on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) to service_role;

comment on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) is
  'Atomically claim one Resend send slot in a sliding lookback window. Critical vs bulk caps enforce reserved capacity. retry_after_ms is clamped to a valid nonnegative integer. Fail-closed for callers on error.';
