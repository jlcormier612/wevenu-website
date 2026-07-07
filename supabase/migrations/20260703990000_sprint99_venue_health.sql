-- Sprint 99: Venue Health Score
-- Composite 0-100 score derived from four dimensions, each equally weighted.
-- Explanation layer (strengths + gaps) makes the score self-interpreting.
-- Tiers: thriving (85-100), growing (60-84), needs_attention (<60).
--
-- Dimensions (25% each):
--   lead_flow          — recent inquiries vs 24-month rolling average
--   pipeline_activity  — % of active leads contacted in last 14 days
--   booking_momentum   — bookings in last 30 days + recency of last booking
--   task_health        — overdue tasks as % of open tasks

create table venue_health_scores (
  id          uuid        primary key default gen_random_uuid(),
  venue_id    uuid        not null references venues(id) on delete cascade unique,
  score       int         not null check (score between 0 and 100),
  tier        text        not null check (tier in ('thriving', 'growing', 'needs_attention')),
  dimensions  jsonb       not null default '{}',
  strengths   jsonb       not null default '[]',
  gaps        jsonb       not null default '[]',
  computed_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index venue_health_scores_venue_idx on venue_health_scores (venue_id);

alter table venue_health_scores enable row level security;

create policy "venues read own health score"
  on venue_health_scores for select to authenticated
  using (
    venue_id = (select venue_id from venue_users where user_id = auth.uid() limit 1)
  );

-- ── compute_venue_health_score ───────────────────────────────────────────────

create or replace function compute_venue_health_score()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id            uuid;
  v_venue_age_days      int;

  -- Dimension scores
  v_lead_flow_score     int;
  v_pipeline_score      int;
  v_booking_score       int;
  v_task_score          int;
  v_total_score         int;
  v_tier                text;

  -- Lead flow
  v_recent_leads        int;
  v_hist_monthly_avg    numeric;

  -- Pipeline activity
  v_active_leads        int;
  v_recently_contacted  int;

  -- Booking momentum
  v_last_booking_days   int;
  v_bookings_30d        int;

  -- Task health
  v_open_tasks          int;
  v_overdue_tasks       int;

  -- Explanation
  v_strengths           jsonb := '[]'::jsonb;
  v_gaps                jsonb := '[]'::jsonb;
  v_dimensions          jsonb;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  if exists (
    select 1 from venue_health_scores
    where venue_id = v_venue_id and computed_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'cached', true);
  end if;

  select round(extract(epoch from (now() - created_at)) / 86400)::int
  into v_venue_age_days
  from venues where id = v_venue_id;

  -- ── Dimension 1: Lead Flow (25%) ──────────────────────────────────────────

  select count(*)::int into v_recent_leads
  from leads
  where venue_id = v_venue_id
    and created_at >= now() - interval '30 days';

  select coalesce(round(avg(cnt)::numeric), 0)::int into v_hist_monthly_avg
  from (
    select date_trunc('month', created_at) as mo, count(*) as cnt
    from leads
    where venue_id = v_venue_id
      and created_at < date_trunc('month', now())
      and created_at >= now() - interval '24 months'
    group by mo
  ) t;

  if v_hist_monthly_avg = 0 or v_venue_age_days < 60 then
    v_lead_flow_score := 70;
  else
    case
      when v_recent_leads >= v_hist_monthly_avg * 1.2 then
        v_lead_flow_score := 90;
        v_strengths := v_strengths || '["Inquiry volume is above your monthly average"]'::jsonb;
      when v_recent_leads >= v_hist_monthly_avg * 0.8 then
        v_lead_flow_score := 75;
      when v_recent_leads >= v_hist_monthly_avg * 0.5 then
        v_lead_flow_score := 50;
        v_gaps := v_gaps || '["Inquiries are running below your monthly average"]'::jsonb;
      else
        v_lead_flow_score := 25;
        v_gaps := v_gaps || '["Inquiry volume is significantly down this month"]'::jsonb;
    end case;
  end if;

  -- ── Dimension 2: Pipeline Activity (25%) ──────────────────────────────────

  select count(*)::int into v_active_leads
  from leads
  where venue_id = v_venue_id
    and status not in ('won', 'lost', 'cancelled');

  select count(*)::int into v_recently_contacted
  from leads
  where venue_id = v_venue_id
    and status not in ('won', 'lost', 'cancelled')
    and last_contacted_at >= current_date - 14;

  if v_active_leads = 0 then
    v_pipeline_score := 70;
  else
    case
      when v_recently_contacted * 1.0 / v_active_leads >= 0.7 then
        v_pipeline_score := 90;
        v_strengths := v_strengths || '["Most active leads have been contacted recently"]'::jsonb;
      when v_recently_contacted * 1.0 / v_active_leads >= 0.4 then
        v_pipeline_score := 65;
      when v_recently_contacted * 1.0 / v_active_leads >= 0.2 then
        v_pipeline_score := 40;
        v_gaps := v_gaps || jsonb_build_array(
          (v_active_leads - v_recently_contacted)::text || ' lead' ||
          (case when (v_active_leads - v_recently_contacted) <> 1 then 's haven''t' else ' hasn''t' end) ||
          ' been contacted in over 2 weeks'
        );
      else
        v_pipeline_score := 20;
        v_gaps := v_gaps || '["Most active leads haven''t been followed up recently"]'::jsonb;
    end case;
  end if;

  -- ── Dimension 3: Booking Momentum (25%) ───────────────────────────────────

  select coalesce(
    round(extract(epoch from (now() - max(created_at))) / 86400)::int, 999
  ) into v_last_booking_days
  from clients where venue_id = v_venue_id;

  select count(*)::int into v_bookings_30d
  from clients
  where venue_id = v_venue_id
    and created_at >= now() - interval '30 days';

  if v_venue_age_days < 90 then
    v_booking_score := 70;
  else
    case
      when v_bookings_30d >= 3 then
        v_booking_score := 95;
        v_strengths := v_strengths || jsonb_build_array(
          v_bookings_30d::text || ' new booking' || (case when v_bookings_30d <> 1 then 's' else '' end) || ' this month'
        );
      when v_bookings_30d >= 1 then
        v_booking_score := 80;
        v_strengths := v_strengths || '["A booking came in this month"]'::jsonb;
      when v_last_booking_days <= 45 then
        v_booking_score := 60;
      when v_last_booking_days <= 60 then
        v_booking_score := 40;
        v_gaps := v_gaps || '["No new bookings in over 45 days"]'::jsonb;
      else
        v_booking_score := 20;
        v_gaps := v_gaps || jsonb_build_array(
          'No new bookings in ' || v_last_booking_days || ' days'
        );
    end case;
  end if;

  -- ── Dimension 4: Task Health (25%) ────────────────────────────────────────

  select count(*)::int into v_open_tasks
  from lead_tasks
  where venue_id = v_venue_id and not completed;

  select count(*)::int into v_overdue_tasks
  from lead_tasks
  where venue_id = v_venue_id
    and not completed
    and due_date is not null
    and due_date < current_date;

  if v_open_tasks = 0 then
    v_task_score := 85;
  elsif v_overdue_tasks = 0 then
    v_task_score := 95;
    v_strengths := v_strengths || '["All open tasks are on track"]'::jsonb;
  else
    case
      when v_overdue_tasks * 1.0 / greatest(v_open_tasks, 1) <= 0.1 then
        v_task_score := 75;
      when v_overdue_tasks * 1.0 / greatest(v_open_tasks, 1) <= 0.3 then
        v_task_score := 50;
        v_gaps := v_gaps || jsonb_build_array(
          v_overdue_tasks::text || ' overdue task' ||
          (case when v_overdue_tasks <> 1 then 's' else '' end) || ' need attention'
        );
      else
        v_task_score := 25;
        v_gaps := v_gaps || jsonb_build_array(
          v_overdue_tasks::text || ' of your open tasks are overdue'
        );
    end case;
  end if;

  -- ── Aggregate ─────────────────────────────────────────────────────────────

  v_total_score := round(
    (v_lead_flow_score + v_pipeline_score + v_booking_score + v_task_score) / 4.0
  )::int;

  v_tier := case
    when v_total_score >= 85 then 'thriving'
    when v_total_score >= 60 then 'growing'
    else 'needs_attention'
  end;

  v_dimensions := jsonb_build_object(
    'leadFlow',          jsonb_build_object('score', v_lead_flow_score,  'label', 'Lead flow',         'weight', 0.25),
    'pipelineActivity',  jsonb_build_object('score', v_pipeline_score,   'label', 'Pipeline activity', 'weight', 0.25),
    'bookingMomentum',   jsonb_build_object('score', v_booking_score,    'label', 'Booking momentum',  'weight', 0.25),
    'taskHealth',        jsonb_build_object('score', v_task_score,       'label', 'Task health',       'weight', 0.25)
  );

  insert into venue_health_scores (venue_id, score, tier, dimensions, strengths, gaps)
  values (v_venue_id, v_total_score, v_tier, v_dimensions, v_strengths, v_gaps)
  on conflict (venue_id) do update
    set score = excluded.score, tier = excluded.tier,
        dimensions = excluded.dimensions, strengths = excluded.strengths,
        gaps = excluded.gaps, computed_at = now(), updated_at = now();

  return jsonb_build_object('ok', true, 'score', v_total_score, 'tier', v_tier);
end;
$$;

-- ── get_venue_health_score ───────────────────────────────────────────────────

create or replace function get_venue_health_score()
returns table (
  score       int,
  tier        text,
  dimensions  jsonb,
  strengths   jsonb,
  gaps        jsonb,
  computed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select score, tier, dimensions, strengths, gaps, computed_at
  from venue_health_scores
  where venue_id = (
    select venue_id from venue_users where user_id = auth.uid() limit 1
  );
$$;
