-- RESEND-SCALE Phase B: distributed SLIDING 1-second pacing for Resend team RPS.
--
-- Provider docs describe a per-second limit but do not guarantee alignment with
-- unix-second boundaries. Fixed epoch buckets allow unsafe adjacent-second
-- bursts (N@999ms + N@1000ms) inside a provider lookback. This migration stores
-- per-acquire timestamps and enforces maxTotal / maxBulk over the trailing
-- p_window_ms (default 1000).
--
-- Fail-closed callers treat RPC errors as "do not send".
-- Operational targets: 9 total / 6 bulk (3 reserved for critical) under 10 rps.

create table if not exists public.resend_send_events (
  id bigint generated always as identity primary key,
  acquired_at_ms bigint not null,
  priority text not null check (priority in ('critical', 'bulk')),
  created_at timestamptz not null default now()
);

create index if not exists resend_send_events_acquired_at_ms_idx
  on public.resend_send_events (acquired_at_ms);

comment on table public.resend_send_events is
  'Sliding-window Resend send acquires (timestamps in unix ms) for distributed team-rate pacing.';

alter table public.resend_send_events enable row level security;

-- Drop fixed-window artifacts if a prior draft of this migration existed locally.
drop table if exists public.resend_send_windows;

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
  v_priority text;
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

  -- Serialize all acquires so concurrent services share one sliding window.
  perform pg_advisory_xact_lock(hashtext('htc_resend_send_pacing'));

  -- Prune events older than 2× window.
  delete from public.resend_send_events
  where acquired_at_ms <= v_now_ms - (v_window_ms * 2);

  select
    coalesce(sum(case when priority = 'critical' then 1 else 0 end), 0),
    coalesce(sum(case when priority = 'bulk' then 1 else 0 end), 0),
    min(acquired_at_ms)
  into v_critical, v_bulk, v_oldest_ms
  from public.resend_send_events
  where acquired_at_ms > v_start_ms;

  v_total := v_critical + v_bulk;
  if v_oldest_ms is null then
    v_retry_ms := 1;
  else
    v_retry_ms := greatest(1, (v_oldest_ms + v_window_ms - v_now_ms + 1)::integer);
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

-- Replace any prior 4-arg overload from a draft migration.
drop function if exists public.acquire_resend_send_slot(text, integer, integer, bigint);

revoke all on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) from public;
grant execute on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) to service_role;

comment on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) is
  'Atomically claim one Resend send slot in a sliding lookback window. Critical vs bulk caps enforce reserved capacity. Fail-closed for callers on error.';

-- Scheduled-message concurrency: claim row as 'sending' so two processors
-- cannot both deliver the same message (RESEND-SCALE Phase B).
alter table public.scheduled_messages
  drop constraint if exists scheduled_messages_status_check;

alter table public.scheduled_messages
  add constraint scheduled_messages_status_check
  check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled'));

comment on column public.scheduled_messages.status is
  'scheduled → sending (claimed) → sent|failed; cancelled cancels before claim.';
