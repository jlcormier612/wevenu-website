-- Sprint 103: Close the Outcome Loop
-- 1. Check constraint on luv_actions.action_type
-- 2. Fix record_luv_action() to snapshot inquiries14dBefore
-- 3. Update compute_action_outcomes() to use 14d baseline (backward-compatible)
-- 4. New get_pending_luv_actions() RPC

-- ── 1. Safety constraint ─────────────────────────────────────────────────────

alter table luv_actions
  add constraint luv_actions_action_type_check
  check (action_type in ('follow_up_messages', 'seasonal_promo', 'availability_plan'));

-- ── 2. record_luv_action — add 14-day lookback snapshot ──────────────────────

create or replace function record_luv_action(
  p_recommendation_id uuid,
  p_action_type       text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id        uuid;
  v_action_id       uuid;
  v_before_snapshot jsonb := '{}';
  v_stale_lead_ids  text[];
  v_stale_count     int;
  v_inquiry_count   int;
  v_lookback_14d    int;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then return null; end if;

  if p_action_type = 'follow_up_messages' then
    select
      array_agg(id::text),
      count(*)::int
    into v_stale_lead_ids, v_stale_count
    from leads
    where venue_id = v_venue_id
      and status not in ('won','lost','cancelled')
      and (last_contacted_at is null or last_contacted_at < current_date - 7);

    v_before_snapshot := jsonb_build_object(
      'staleLeadCount', coalesce(v_stale_count, 0),
      'staleLeadIds',   to_jsonb(coalesce(v_stale_lead_ids, array[]::text[]))
    );

  elsif p_action_type in ('seasonal_promo', 'availability_plan') then
    -- Current month total (kept for context)
    select count(*)::int into v_inquiry_count
    from leads
    where venue_id = v_venue_id
      and created_at >= date_trunc('month', now())
      and created_at < now();

    -- 14-day lookback — the proper comparison baseline for 14-day after-window
    select count(*)::int into v_lookback_14d
    from leads
    where venue_id = v_venue_id
      and created_at >= now() - interval '14 days'
      and created_at < now();

    v_before_snapshot := jsonb_build_object(
      'inquiriesThisMonth',  coalesce(v_inquiry_count, 0),
      'inquiries14dBefore',  coalesce(v_lookback_14d, 0),
      'snapshotDate',        (now()::date)::text
    );
  end if;

  insert into luv_actions
    (venue_id, recommendation_id, action_type, status, outcome_jsonb, started_at)
  values
    (v_venue_id, p_recommendation_id, p_action_type, 'started',
     jsonb_build_object('before', v_before_snapshot), now())
  returning id into v_action_id;

  return v_action_id;
end;
$$;

-- ── 3. compute_action_outcomes — use inquiries14dBefore when available ────────

create or replace function compute_action_outcomes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id     uuid;
  v_action       record;
  v_before_count int;
  v_after_count  int;
  v_contacted    int;
  v_saved        int := 0;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- follow_up_messages: measure after 7 days
  for v_action in
    select a.*
    from luv_actions a
    where a.venue_id = v_venue_id
      and a.action_type = 'follow_up_messages'
      and a.status in ('started','completed')
      and a.started_at < now() - interval '7 days'
      and a.started_at > now() - interval '60 days'
      and not exists (select 1 from luv_action_outcomes where action_id = a.id)
  loop
    v_before_count := coalesce(
      (v_action.outcome_jsonb->'before'->>'staleLeadCount')::int, 0
    );

    if jsonb_array_length(
      coalesce(v_action.outcome_jsonb->'before'->'staleLeadIds', '[]'::jsonb)
    ) = 0 then
      continue;
    end if;

    select count(*)::int into v_contacted
    from leads l
    where l.venue_id = v_venue_id
      and l.last_contacted_at::date > v_action.started_at::date
      and l.id::text = any(
        array(
          select jsonb_array_elements_text(
            v_action.outcome_jsonb->'before'->'staleLeadIds'
          )
        )
      );

    insert into luv_action_outcomes
      (action_id, metric_name, before_value, after_value, delta, observed_at)
    values
      (v_action.id, 'leads_contacted', v_before_count, v_contacted,
       v_contacted, now());

    v_saved := v_saved + 1;
  end loop;

  -- seasonal_promo: measure after 14 days
  for v_action in
    select a.*
    from luv_actions a
    where a.venue_id = v_venue_id
      and a.action_type = 'seasonal_promo'
      and a.status in ('started','completed')
      and a.started_at < now() - interval '14 days'
      and a.started_at > now() - interval '90 days'
      and not exists (select 1 from luv_action_outcomes where action_id = a.id)
  loop
    -- Prefer 14d lookback (Sprint 103+); fall back to month total for older rows
    v_before_count := coalesce(
      (v_action.outcome_jsonb->'before'->>'inquiries14dBefore')::int,
      (v_action.outcome_jsonb->'before'->>'inquiriesThisMonth')::int,
      0
    );

    select count(*)::int into v_after_count
    from leads
    where venue_id = v_venue_id
      and created_at > v_action.started_at
      and created_at < v_action.started_at + interval '14 days';

    insert into luv_action_outcomes
      (action_id, metric_name, before_value, after_value, delta, observed_at)
    values
      (v_action.id, 'new_inquiries_14d', v_before_count, v_after_count,
       v_after_count - v_before_count, now());

    v_saved := v_saved + 1;
  end loop;

  -- availability_plan: measure after 14 days
  for v_action in
    select a.*
    from luv_actions a
    where a.venue_id = v_venue_id
      and a.action_type = 'availability_plan'
      and a.status in ('started','completed')
      and a.started_at < now() - interval '14 days'
      and a.started_at > now() - interval '90 days'
      and not exists (select 1 from luv_action_outcomes where action_id = a.id)
  loop
    v_before_count := coalesce(
      (v_action.outcome_jsonb->'before'->>'inquiries14dBefore')::int,
      (v_action.outcome_jsonb->'before'->>'inquiriesThisMonth')::int,
      0
    );

    select count(*)::int into v_after_count
    from leads
    where venue_id = v_venue_id
      and created_at > v_action.started_at
      and created_at < v_action.started_at + interval '14 days';

    insert into luv_action_outcomes
      (action_id, metric_name, before_value, after_value, delta, observed_at)
    values
      (v_action.id, 'new_inquiries_14d', v_before_count, v_after_count,
       v_after_count - v_before_count, now());

    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_saved);
end;
$$;

-- ── 4. get_pending_luv_actions ────────────────────────────────────────────────
-- Returns one row per action_type for actions that are being tracked
-- but haven't yet had outcomes computed.

create or replace function get_pending_luv_actions()
returns table (
  action_id          uuid,
  action_type        text,
  started_at         timestamptz,
  measure_after_days int
)
language sql
security definer
set search_path = public
as $$
  select distinct on (a.action_type)
    a.id,
    a.action_type,
    a.started_at,
    case a.action_type
      when 'follow_up_messages' then 7
      else 14
    end as measure_after_days
  from luv_actions a
  where a.venue_id in (
    select venue_id from venue_users where user_id = auth.uid()
  )
    and a.status in ('started', 'completed')
    and not exists (
      select 1 from luv_action_outcomes where action_id = a.id
    )
    and a.started_at > now() - interval '90 days'
  order by a.action_type, a.started_at desc;
$$;
