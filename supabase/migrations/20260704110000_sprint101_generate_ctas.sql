-- Sprint 101: Luv AI Drafting
-- Renames CTA targets to richer action names and enriches recommendation
-- metadata with evidenceBullets for the "Why is Luv recommending this?" panel.
-- cta.type = "generate" → LuvDraftSheet; cta.type = "navigate" → Link.
-- Schema is unchanged — this is purely a function + data update.

-- Clear existing recommendations so they regenerate with new CTAs on next load.
delete from luv_recommendations;

-- Rebuild generate_venue_recommendations with richer generate CTAs + evidence.
create or replace function generate_venue_recommendations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id          uuid;
  v_stale_leads       int;
  v_pipeline_score    int;
  v_insight_id        uuid;
  v_insight_evidence  jsonb;
  v_monthly_avgs      jsonb;
  v_next_month_num    int;
  v_next_month_name   text;
  v_overall_avg       numeric;
  v_next_month_avg    numeric;
  v_next_ratio        numeric;
  v_pacing_ratio      numeric;
  v_days_elapsed      text;
  v_recs_generated    int := 0;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- ── 1. Lead Follow-Up ─────────────────────────────────────────────────────

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
        '[{"label":"Draft follow-up messages \u2728","target":"follow_up_messages","type":"generate"},{"label":"Review inquiries \u2192","target":"/leads","type":"navigate"}]'::jsonb,
        jsonb_build_object(
          'staleLeadCount', v_stale_leads,
          'evidenceBullets', jsonb_build_array(
            v_stale_leads::text || ' active ' ||
              case when v_stale_leads = 1 then 'inquiry hasn''t' else 'inquiries haven''t' end ||
              ' been contacted in 7+ days',
            case when coalesce(v_pipeline_score, 70) < 50
              then 'Pipeline activity is running below healthy levels — outreach is especially important now'
              else 'Regular follow-up is one of the strongest drivers of inquiry conversion'
            end
          )
        ),
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
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'lead_followup'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 2. Inquiry Reactivation ────────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'inquiry_reactivation'
      and dismissed_at > now() - interval '7 days'
  ) then
    select id, evidence into v_insight_id, v_insight_evidence
    from luv_insights
    where venue_id = v_venue_id
      and type = 'inquiry_pacing'
      and is_actionable = true
      and confidence in ('medium', 'high')
    limit 1;

    if v_insight_id is not null then
      v_pacing_ratio := coalesce((v_insight_evidence ->> 'pacingRatio')::numeric, 0.75);
      v_days_elapsed := coalesce(v_insight_evidence ->> 'daysElapsed', 'Several');

      insert into luv_recommendations
        (venue_id, insight_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        v_insight_id,
        'inquiry_reactivation',
        'Your inquiry volume is below average this month',
        'This is a good moment to strengthen your presence — revisit your packages, refresh your listings, or reach out to warm leads who haven''t responded yet.',
        70,
        '[{"label":"Create seasonal promotion \u2728","target":"seasonal_promo","type":"generate"},{"label":"View pipeline \u2192","target":"/leads","type":"navigate"},{"label":"Open Packages \u2192","target":"/library/packages","type":"navigate"}]'::jsonb,
        jsonb_build_object(
          'insightId', v_insight_id,
          'evidenceBullets', jsonb_build_array(
            'Inquiry volume is ' ||
              round((1 - v_pacing_ratio) * 100)::text ||
              '% below your monthly average',
            v_days_elapsed || ' days into the month — pacing is behind historical baseline',
            'Venues that increase visibility during slower periods often recover within 2–3 weeks'
          )
        ),
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
            '[{"label":"Prepare availability plan \u2728","target":"availability_plan","type":"generate"},{"label":"View calendar \u2192","target":"/calendar","type":"navigate"},{"label":"Manage availability \u2192","target":"/settings/availability","type":"navigate"}]'::jsonb,
            jsonb_build_object(
              'nextMonthNum',  v_next_month_num,
              'nextMonthName', v_next_month_name,
              'nextRatio',     round(v_next_ratio, 2),
              'evidenceBullets', jsonb_build_array(
                v_next_month_name || ' historically brings ' ||
                  round((v_next_ratio - 1) * 100)::text ||
                  '% more inquiries than your monthly average',
                'Based on ' || jsonb_array_length(v_monthly_avgs)::text || ' months of historical inquiry data',
                'Venues that prepare 3–4 weeks early capture more bookings during peak months'
              )
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
