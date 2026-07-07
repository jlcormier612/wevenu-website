-- Sprint 102: Luv Follow-Through
-- Action tracking + outcome measurement.
-- Records what venue does after a recommendation, snapshots before-state,
-- computes after-state 7–14 days later, surfaces results as Luv observations.

-- ── Tables ─────────────────────────────────────────────────────────────────

create table luv_actions (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references venues(id) on delete cascade,
  recommendation_id uuid references luv_recommendations(id) on delete set null,
  action_type       text not null,
  status            text not null default 'started'
                    check (status in ('pending','started','completed','dismissed','expired')),
  outcome_jsonb     jsonb not null default '{}',
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create table luv_action_outcomes (
  id           uuid primary key default gen_random_uuid(),
  action_id    uuid not null references luv_actions(id) on delete cascade,
  metric_name  text not null,
  before_value numeric,
  after_value  numeric,
  delta        numeric,
  observed_at  timestamptz not null default now()
);

create index on luv_actions (venue_id, action_type, started_at desc);
create index on luv_action_outcomes (action_id);

alter table luv_actions         enable row level security;
alter table luv_action_outcomes enable row level security;

create policy "venue_actions_policy" on luv_actions
  for all using (
    venue_id in (select venue_id from venue_users where user_id = auth.uid())
  );

create policy "venue_action_outcomes_policy" on luv_action_outcomes
  for all using (
    action_id in (
      select id from luv_actions
      where venue_id in (select venue_id from venue_users where user_id = auth.uid())
    )
  );

-- ── record_luv_action ───────────────────────────────────────────────────────
-- Creates an action record and snapshots before-metrics.
-- Returns the new action id.

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
    select count(*)::int into v_inquiry_count
    from leads
    where venue_id = v_venue_id
      and created_at >= date_trunc('month', now())
      and created_at < now();

    v_before_snapshot := jsonb_build_object(
      'inquiriesThisMonth', coalesce(v_inquiry_count, 0),
      'snapshotDate',       (now()::date)::text
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

-- ── complete_luv_action ─────────────────────────────────────────────────────

create or replace function complete_luv_action(p_action_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update luv_actions
  set status = 'completed', completed_at = now()
  where id = p_action_id
    and venue_id in (select venue_id from venue_users where user_id = auth.uid());
end;
$$;

-- ── compute_action_outcomes ─────────────────────────────────────────────────
-- Idempotent: computes outcomes only for actions old enough to measure
-- that don't already have outcome rows.

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
    v_before_count := coalesce(
      (v_action.outcome_jsonb->'before'->>'inquiriesThisMonth')::int, 0
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
      (v_action.outcome_jsonb->'before'->>'inquiriesThisMonth')::int, 0
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

-- ── get_luv_action_outcomes ─────────────────────────────────────────────────
-- Returns the most recent measured outcome per action type.
-- Used by action-service.ts to build Luv observations.

create or replace function get_luv_action_outcomes()
returns table (
  action_id    uuid,
  action_type  text,
  started_at   timestamptz,
  completed_at timestamptz,
  metric_name  text,
  before_value numeric,
  after_value  numeric,
  delta        numeric,
  observed_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select distinct on (a.action_type)
    a.id,
    a.action_type,
    a.started_at,
    a.completed_at,
    o.metric_name,
    o.before_value,
    o.after_value,
    o.delta,
    o.observed_at
  from luv_actions a
  join luv_action_outcomes o on o.action_id = a.id
  where a.venue_id in (
    select venue_id from venue_users where user_id = auth.uid()
  )
  and a.started_at > now() - interval '90 days'
  order by a.action_type, a.started_at desc;
$$;
