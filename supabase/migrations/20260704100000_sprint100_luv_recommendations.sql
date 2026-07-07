-- Sprint 100: Luv Recommendation Engine
-- Recommendations are Luv's first opinion layer — specific, actionable advice
-- derived from memories, insights, and health scores.
-- Sprint 101 extends cta.type from "navigate" to "generate" for AI drafting.
--
-- Three recommendation types in Sprint 100:
--   lead_followup        — stale active leads (>7 days without contact)
--   inquiry_reactivation — inquiry pacing below seasonal baseline (is_actionable)
--   seasonal_prep        — next month is historically a peak inquiry month

create table luv_recommendations (
  id           uuid        primary key default gen_random_uuid(),
  venue_id     uuid        not null references venues(id) on delete cascade,
  insight_id   uuid        references luv_insights(id) on delete set null,
  type         text        not null,
  title        text        not null,
  body         text        not null,
  priority     int         not null default 50 check (priority between 0 and 100),
  ctas         jsonb       not null default '[]',
  metadata     jsonb       not null default '{}',
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  unique (venue_id, type)
);

-- CTAs are a jsonb array of { label, target, type }.
-- type = "navigate" in Sprint 100.
-- type = "generate" in Sprint 101 (drops in without schema change).

create index luv_recommendations_venue_idx on luv_recommendations (venue_id);

alter table luv_recommendations enable row level security;

create policy "venues read own recommendations"
  on luv_recommendations for select to authenticated
  using (
    venue_id = (select venue_id from venue_users where user_id = auth.uid() limit 1)
  );

-- ── generate_venue_recommendations ──────────────────────────────────────────
-- Derives and upserts all recommendation types for the current venue.
-- Respects dismissal windows: dismissed < 7 days ago → skip.
-- Cleans up stale recommendations when conditions are no longer met.

create or replace function generate_venue_recommendations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id        uuid;
  v_stale_leads     int;
  v_pipeline_score  int;
  v_insight_id      uuid;
  v_monthly_avgs    jsonb;
  v_next_month_num  int;
  v_next_month_name text;
  v_overall_avg     numeric;
  v_next_month_avg  numeric;
  v_next_ratio      numeric;
  v_recs_generated  int := 0;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- ── 1. Lead Follow-Up ─────────────────────────────────────────────────────
  -- Surface when ≥2 active leads haven't been contacted in 7+ days.

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'lead_followup'
      and dismissed_at > now() - interval '7 days'
  ) then
    select count(*)::int into v_stale_leads
    from leads
    where venue_id = v_venue_id
      and status not in ('won', 'lost', 'cancelled')
      and (last_contacted_at is null or last_contacted_at < current_date - 7);

    if v_stale_leads >= 2 then
      select coalesce(
        (dimensions -> 'pipelineActivity' ->> 'score')::int, 70
      ) into v_pipeline_score
      from venue_health_scores where venue_id = v_venue_id;

      insert into luv_recommendations
        (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        'lead_followup',
        v_stale_leads::text || ' active lead' ||
          (case when v_stale_leads <> 1 then 's haven''t' else ' hasn''t' end) ||
          ' been contacted in 7+ days',
        'These leads may cool off without a nudge. A short follow-up keeps the relationship warm and your pipeline moving.',
        case when coalesce(v_pipeline_score, 70) < 50 then 80 else 65 end,
        '[{"label":"Review inquiries \u2192","target":"/leads","type":"navigate"}]'::jsonb,
        jsonb_build_object('staleLeadCount', v_stale_leads),
        null, null,
        now() + interval '3 days'
      )
      on conflict (venue_id, type) do update
        set title        = excluded.title,
            body         = excluded.body,
            priority     = excluded.priority,
            ctas         = excluded.ctas,
            metadata     = excluded.metadata,
            dismissed_at = null,
            completed_at = null,
            expires_at   = excluded.expires_at;

      v_recs_generated := v_recs_generated + 1;
    else
      -- Conditions cleared — remove if still pending
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'lead_followup'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 2. Inquiry Reactivation ────────────────────────────────────────────────
  -- Surface when an actionable inquiry_pacing insight exists (pacing below baseline).

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'inquiry_reactivation'
      and dismissed_at > now() - interval '7 days'
  ) then
    select id into v_insight_id
    from luv_insights
    where venue_id = v_venue_id
      and type = 'inquiry_pacing'
      and is_actionable = true
      and confidence in ('medium', 'high')
    limit 1;

    if v_insight_id is not null then
      insert into luv_recommendations
        (venue_id, insight_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        v_insight_id,
        'inquiry_reactivation',
        'Your inquiry volume is below average this month',
        'This is a good moment to strengthen your presence — revisit your packages, refresh your listings, or reach out to warm leads who haven''t responded yet.',
        70,
        '[{"label":"View pipeline \u2192","target":"/leads","type":"navigate"},{"label":"Open Packages \u2192","target":"/library/packages","type":"navigate"}]'::jsonb,
        jsonb_build_object('insightId', v_insight_id),
        null, null,
        now() + interval '14 days'
      )
      on conflict (venue_id, type) do update
        set insight_id   = excluded.insight_id,
            title        = excluded.title,
            body         = excluded.body,
            ctas         = excluded.ctas,
            metadata     = excluded.metadata,
            dismissed_at = null,
            completed_at = null,
            expires_at   = excluded.expires_at;

      v_recs_generated := v_recs_generated + 1;
    else
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'inquiry_reactivation'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 3. Seasonal Inventory Prep ─────────────────────────────────────────────
  -- Surface when next calendar month is a historically peak inquiry month.

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'seasonal_prep'
      and dismissed_at > now() - interval '14 days'
  ) then
    select value into v_monthly_avgs
    from luv_memories
    where venue_id = v_venue_id and key = 'monthly_inquiry_averages';

    if v_monthly_avgs is not null and jsonb_array_length(v_monthly_avgs) >= 6 then
      v_next_month_num := (extract(month from now())::int % 12) + 1;

      select
        avg((elem ->> 'avg')::numeric),
        max(case when (elem ->> 'month')::int = v_next_month_num
              then (elem ->> 'avg')::numeric end)
      into v_overall_avg, v_next_month_avg
      from jsonb_array_elements(v_monthly_avgs) as elem;

      if v_overall_avg > 0 and v_next_month_avg is not null then
        v_next_ratio := v_next_month_avg / v_overall_avg;

        if v_next_ratio >= 1.35 then
          v_next_month_name := trim(to_char(
            date_trunc('month', now()) + interval '1 month', 'Month'
          ));

          insert into luv_recommendations
            (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
          values (
            v_venue_id,
            'seasonal_prep',
            v_next_month_name || ' is historically one of your peak months — it''s coming up soon',
            'Based on past years, ' || v_next_month_name ||
              ' brings well above your average inquiry volume. Opening availability early and refreshing your packages now could help you capture more bookings.',
            60,
            '[{"label":"View calendar \u2192","target":"/calendar","type":"navigate"},{"label":"Manage availability \u2192","target":"/settings/availability","type":"navigate"}]'::jsonb,
            jsonb_build_object(
              'nextMonthNum',  v_next_month_num,
              'nextMonthName', v_next_month_name,
              'nextRatio',     round(v_next_ratio, 2)
            ),
            null, null,
            now() + interval '21 days'
          )
          on conflict (venue_id, type) do update
            set title        = excluded.title,
                body         = excluded.body,
                ctas         = excluded.ctas,
                metadata     = excluded.metadata,
                dismissed_at = null,
                completed_at = null,
                expires_at   = excluded.expires_at;

          v_recs_generated := v_recs_generated + 1;
        else
          delete from luv_recommendations
          where venue_id = v_venue_id
            and type = 'seasonal_prep'
            and dismissed_at is null
            and completed_at is null;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'generated', v_recs_generated);
end;
$$;

-- ── get_venue_recommendations ────────────────────────────────────────────────
-- Returns active (non-dismissed, non-completed, non-expired) recommendations
-- ordered by priority. Dismissed recommendations resurface after 7 days.

create or replace function get_venue_recommendations()
returns table (
  id           uuid,
  insight_id   uuid,
  type         text,
  title        text,
  body         text,
  priority     int,
  ctas         jsonb,
  metadata     jsonb,
  dismissed_at timestamptz,
  completed_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, insight_id, type, title, body, priority, ctas, metadata,
         dismissed_at, completed_at, expires_at, created_at
  from luv_recommendations
  where venue_id = (
    select venue_id from venue_users where user_id = auth.uid() limit 1
  )
    and completed_at is null
    and (dismissed_at is null or dismissed_at <= now() - interval '7 days')
    and (expires_at is null or expires_at > now())
  order by priority desc
  limit 5;
$$;

-- ── update_recommendation_status ─────────────────────────────────────────────

create or replace function update_recommendation_status(
  p_recommendation_id uuid,
  p_action            text   -- 'dismiss' | 'complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if p_action = 'dismiss' then
    update luv_recommendations
    set dismissed_at = now()
    where id = p_recommendation_id and venue_id = v_venue_id;
  elsif p_action = 'complete' then
    update luv_recommendations
    set completed_at = now()
    where id = p_recommendation_id and venue_id = v_venue_id;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid action');
  end if;

  return jsonb_build_object('ok', found);
end;
$$;
