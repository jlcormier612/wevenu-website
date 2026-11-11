-- Luv Phase 5 Spot Patterns — sync allowlisted L2 recommendations into
-- existing luv_recommendations (no new table / no second lifecycle).
--
-- Types: unattended_inquiry_pattern | payment_attention_pattern | inquiry_volume_increase
-- Mirrors sync_tour_followup_pattern_recommendation dismiss harden (7-day).

create or replace function public.sync_luv_spot_pattern_recommendation(
  p_type text,
  p_rec jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_type text;
  v_upserted int := 0;
  v_cleared int := 0;
  v_active boolean := false;
begin
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  v_type := nullif(trim(coalesce(p_type, '')), '');
  if v_type is null
     or v_type not in (
       'unattended_inquiry_pattern',
       'payment_attention_pattern',
       'inquiry_volume_increase'
     )
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_type');
  end if;

  if p_rec is not null
     and jsonb_typeof(p_rec) = 'object'
     and nullif(trim(coalesce(p_rec ->> 'type', '')), '') = v_type
  then
    v_active := true;
  end if;

  if v_active then
    if exists (
      select 1 from luv_recommendations
      where venue_id = v_venue_id
        and type = v_type
        and dismissed_at > now() - interval '7 days'
    ) then
      return jsonb_build_object(
        'ok', true,
        'upserted', 0,
        'cleared', 0,
        'skipped', 'recently_dismissed'
      );
    end if;

    insert into luv_recommendations
      (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
    values (
      v_venue_id,
      v_type,
      coalesce(nullif(trim(p_rec ->> 'title'), ''), 'Pattern noticed'),
      coalesce(nullif(trim(p_rec ->> 'body'), ''), ''),
      least(100, greatest(0, coalesce((p_rec ->> 'priority')::int, 70))),
      coalesce(p_rec -> 'ctas', '[]'::jsonb),
      coalesce(p_rec -> 'metadata', '{}'::jsonb),
      null,
      null,
      null
    )
    on conflict (venue_id, type) do update
      set title    = excluded.title,
          body     = excluded.body,
          priority = excluded.priority,
          ctas     = excluded.ctas,
          metadata = excluded.metadata
      where luv_recommendations.dismissed_at is null
         or luv_recommendations.dismissed_at <= now() - interval '7 days';

    get diagnostics v_upserted = row_count;
  else
    with deleted as (
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = v_type
        and dismissed_at is null
        and completed_at is null
      returning 1
    )
    select count(*)::int into v_cleared from deleted;
  end if;

  return jsonb_build_object(
    'ok', true,
    'type', v_type,
    'upserted', v_upserted,
    'cleared', v_cleared
  );
end;
$$;

revoke all on function public.sync_luv_spot_pattern_recommendation(text, jsonb) from public;
grant execute on function public.sync_luv_spot_pattern_recommendation(text, jsonb)
  to authenticated;

comment on function public.sync_luv_spot_pattern_recommendation(text, jsonb) is
  'Upsert or clear a Phase 5 L2 spot-pattern recommendation for current_user_venue_id(). Never resurrects a dismissal within 7 days.';

-- ── Targeted booking metric repair for get_venue_trends ──────────────────────
-- Canonical Booking = Lead → Booked/Client transition (first_booked_at).
-- Do NOT use leads.status = 'won' or clients.created_at.

create or replace function public.get_venue_trends()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id        uuid;
  now_ts            timestamptz := now();

  month_start       timestamptz := now_ts - interval '30 days';
  prior_month_start timestamptz := now_ts - interval '60 days';
  prior_month_end   timestamptz := now_ts - interval '30 days';

  week_start        timestamptz := now_ts - interval '7 days';
  prior_week_start  timestamptz := now_ts - interval '14 days';
  prior_week_end    timestamptz := now_ts - interval '7 days';

  cm_leads      int; pm_leads      int;
  cm_tours      int; pm_tours      int;
  cm_booked     int; pm_booked     int;
  cm_payments   numeric; pm_payments   numeric;

  cw_leads      int; pw_leads      int;
  cw_tours      int; pw_tours      int;

  best_day      text;
  best_day_rate numeric;
  avg_dow_rate  numeric;
begin
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is null then
    return '{"error":"no_venue"}'::jsonb;
  end if;

  select count(*) into cm_leads from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and created_at >= month_start;

  select count(*) into pm_leads from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and created_at >= prior_month_start and created_at < prior_month_end;

  select count(*) into cm_tours from tour_appointments
  where venue_id = v_venue_id and created_at >= month_start;

  select count(*) into pm_tours from tour_appointments
  where venue_id = v_venue_id
    and created_at >= prior_month_start and created_at < prior_month_end;

  -- Canonical booking clock: first_booked_at (manual or automation Lead→Booked).
  select count(*) into cm_booked from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and first_booked_at is not null
    and first_booked_at >= month_start;

  select count(*) into pm_booked from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and first_booked_at is not null
    and first_booked_at >= prior_month_start and first_booked_at < prior_month_end;

  select coalesce(sum(paid_amount), 0) into cm_payments
  from payment_line_items
  where venue_id = v_venue_id and status = 'paid' and paid_at >= month_start;

  select coalesce(sum(paid_amount), 0) into pm_payments
  from payment_line_items
  where venue_id = v_venue_id and status = 'paid'
    and paid_at >= prior_month_start and paid_at < prior_month_end;

  select count(*) into cw_leads from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and created_at >= week_start;

  select count(*) into pw_leads from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and created_at >= prior_week_start and created_at < prior_week_end;

  select count(*) into cw_tours from tour_appointments
  where venue_id = v_venue_id and created_at >= week_start;

  select count(*) into pw_tours from tour_appointments
  where venue_id = v_venue_id
    and created_at >= prior_week_start and created_at < prior_week_end;

  with dow_stats as (
    select
      trim(to_char(t.scheduled_at at time zone 'UTC', 'Day')) as day_name,
      count(*)                                     as total,
      count(*) filter (where l.first_booked_at is not null) as converted
    from tour_appointments t
    left join leads l on l.id = t.lead_id
    where t.venue_id = v_venue_id
      and t.status = 'completed'
    group by day_name
    having count(*) >= 3
  ),
  ranked as (
    select *,
      round(converted::numeric / nullif(total, 0) * 100) as rate
    from dow_stats
  )
  select day_name, rate
  into best_day, best_day_rate
  from ranked
  order by rate desc
  limit 1;

  select round(
    sum(converted)::numeric / nullif(sum(total), 0) * 100
  ) into avg_dow_rate
  from (
    select
      count(*) as total,
      count(*) filter (where l.first_booked_at is not null) as converted
    from tour_appointments t
    left join leads l on l.id = t.lead_id
    where t.venue_id = v_venue_id and t.status = 'completed'
  ) sub;

  return jsonb_build_object(
    'currentMonth', jsonb_build_object(
      'leads',             cm_leads,
      'tours',             cm_tours,
      'booked',            cm_booked,
      'paymentsCollected', cm_payments
    ),
    'priorMonth', jsonb_build_object(
      'leads',             pm_leads,
      'tours',             pm_tours,
      'booked',            pm_booked,
      'paymentsCollected', pm_payments
    ),
    'currentWeek', jsonb_build_object(
      'leads', cw_leads,
      'tours', cw_tours
    ),
    'priorWeek', jsonb_build_object(
      'leads', pw_leads,
      'tours', pw_tours
    ),
    'insights', jsonb_build_object(
      'bestTourDay',            best_day,
      'bestTourDayRate',        best_day_rate,
      'avgTourConversionRate',  avg_dow_rate
    )
  );
end;
$$;

grant execute on function public.get_venue_trends() to authenticated;

-- Repair compute_venue_insights:
-- 1) venue via current_user_venue_id() (active venue, not venue_users LIMIT 1)
-- 2) momentum bookings via leads.first_booked_at (canonical Lead→Booked)
--    — never clients.created_at / status='won' / payments / contracts
-- Seasonal + inquiry pacing left intact aside from active-venue resolution.

create or replace function public.compute_venue_insights()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id            uuid;
  v_peak_quarter        int;
  v_concentration_pct   int;
  v_years_analyzed      int;
  v_total_bookings      int;
  v_historical_avg      numeric;
  v_hist_years          int;
  v_current_count       int;
  v_day_of_month        int;
  v_days_in_month       int;
  v_projected           int;
  v_pacing_ratio        numeric;
  v_recent_bookings     int;
  v_prior_bookings      int;
  v_recent_inquiries    int;
  v_prior_inquiries     int;
  v_booking_accel       numeric;
  v_inquiry_accel       numeric;
  v_confidence_score    int;
  v_confidence          text;
  v_quarter_name        text;
  v_title               text;
  v_body                text;
  v_is_actionable       boolean;
begin
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  if exists (
    select 1 from luv_insights
    where venue_id = v_venue_id
      and computed_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'cached', true);
  end if;

  -- ── 1. Seasonal Booking Concentration (unchanged source: clients.event_date) ─

  select
    extract(quarter from event_date)::int,
    round(count(*) * 100.0 / sum(count(*)) over())::int,
    count(distinct extract(year from event_date)::int)::int,
    (sum(count(*)) over())::int
  into v_peak_quarter, v_concentration_pct, v_years_analyzed, v_total_bookings
  from clients
  where venue_id = v_venue_id
    and event_date is not null
    and coalesce(exclude_from_business_reporting, false) = false
  group by extract(quarter from event_date)::int
  order by count(*) desc
  limit 1;

  if v_peak_quarter is not null and v_concentration_pct >= 30 then
    v_confidence_score := least(100,
      (case when v_years_analyzed >= 3 then 50
            when v_years_analyzed >= 2 then 35
            else 20 end)
      + least(30, v_total_bookings)
      + (case when v_concentration_pct >= 45 then 15
              when v_concentration_pct >= 35 then 10
              else 5 end)
    );
    v_confidence := case
      when v_confidence_score >= 70 then 'high'
      when v_confidence_score >= 45 then 'medium'
      else 'low' end;
    v_quarter_name := case v_peak_quarter
      when 1 then 'January–March'
      when 2 then 'April–June'
      when 3 then 'July–September'
      else        'October–December' end;
    v_title := case v_confidence
      when 'high'   then 'You typically book ' || v_concentration_pct || '% of your weddings in ' || v_quarter_name
      when 'medium' then v_quarter_name || ' appears to be your peak booking season'
      else               v_quarter_name || ' may be your busiest booking season' end;
    v_body := case v_confidence
      when 'high'   then
        'Based on ' || v_years_analyzed || ' years of data, roughly ' || v_concentration_pct ||
        '% of your booked events fall in ' || v_quarter_name ||
        '. Worth opening availability and running promotions early in this window.'
      when 'medium' then
        'Across ' || v_years_analyzed || ' years, ' || v_quarter_name ||
        ' tends to be your strongest booking period. Still building confidence as more data comes in.'
      else
        'Early patterns suggest ' || v_quarter_name ||
        ' could be your busiest season. More data will sharpen this picture.' end;

    insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence, is_actionable)
    values (v_venue_id, 'seasonal_concentration', v_title, v_body, v_confidence, v_confidence_score,
      jsonb_build_object(
        'peakQuarter',       v_peak_quarter,
        'quarterName',       v_quarter_name,
        'concentrationPct',  v_concentration_pct,
        'yearsAnalyzed',     v_years_analyzed,
        'totalBookings',     v_total_bookings
      ), false)
    on conflict (venue_id, type) do update
      set title = excluded.title, body = excluded.body,
          confidence = excluded.confidence, confidence_score = excluded.confidence_score,
          evidence = excluded.evidence, is_actionable = excluded.is_actionable,
          computed_at = now(), updated_at = now();
  end if;

  -- ── 2. Inquiry Pacing ─────────────────────────────────────────────────────

  select
    coalesce(round(avg(cnt)::numeric, 1), 0),
    count(*)::int
  into v_historical_avg, v_hist_years
  from (
    select extract(year from created_at)::int, count(*) as cnt
    from leads
    where venue_id = v_venue_id
      and coalesce(exclude_from_business_reporting, false) = false
      and extract(month from created_at)::int = extract(month from now())::int
      and extract(year from created_at)::int < extract(year from now())::int
    group by 1
  ) t;

  select count(*)::int into v_current_count
  from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and created_at >= date_trunc('month', now());

  v_day_of_month  := extract(day from now())::int;
  v_days_in_month := extract(day from
    (date_trunc('month', now()) + interval '1 month' - interval '1 day'))::int;
  v_projected := round(
    v_current_count * 1.0 * v_days_in_month / greatest(v_day_of_month, 1)
  )::int;

  if v_hist_years >= 1 and v_historical_avg > 0 and v_day_of_month >= 7 then
    v_pacing_ratio := v_projected * 1.0 / v_historical_avg;
    v_confidence_score := least(100,
      (case when v_hist_years >= 3 then 55
            when v_hist_years >= 2 then 40
            else 25 end)
      + least(20, v_current_count * 2)
      + (case when v_day_of_month >= 21 then 15
              when v_day_of_month >= 14 then 10
              else 5 end)
    );
    v_confidence := case
      when v_confidence_score >= 70 then 'high'
      when v_confidence_score >= 45 then 'medium'
      else 'low' end;

    if v_pacing_ratio >= 1.25 then
      v_is_actionable := false;
      v_title := case v_confidence
        when 'high'   then 'Inquiries are tracking above your seasonal average this month'
        when 'medium' then 'Inquiries may be running above average this month'
        else               'Inquiry pace looks slightly elevated this month' end;
      v_body := case v_confidence
        when 'high'   then
          'You''re on pace for ~' || v_projected || ' inquiries this month — above your historical average of ' ||
          round(v_historical_avg)::int || '. Strong month ahead.'
        when 'medium' then
          'Based on ' || v_hist_years || ' previous years, your typical count is around ' ||
          round(v_historical_avg)::int || '. This month appears to be tracking higher.'
        else
          'Still early to tell, but this month''s inquiry count looks above the pattern from previous years.' end;
    elsif v_pacing_ratio <= 0.75 then
      v_is_actionable := true;
      v_title := case v_confidence
        when 'high'   then 'Inquiries are tracking below your seasonal average this month'
        when 'medium' then 'Inquiries may be running slower than usual this month'
        else               'Inquiry pace looks slightly below average this month' end;
      v_body := case v_confidence
        when 'high'   then
          'You''re on pace for ~' || v_projected || ' inquiries this month — below your typical ' ||
          round(v_historical_avg)::int || '. A good time to boost your presence or follow up on warm leads.'
        when 'medium' then
          'Based on previous years, this month usually brings around ' || round(v_historical_avg)::int ||
          ' inquiries. The current pace appears a bit lower.'
        else
          'Inquiry volume looks a little quieter than past patterns suggest for this time of year.' end;
    else
      v_title := null;
    end if;

    if v_title is not null then
      insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence, is_actionable)
      values (v_venue_id, 'inquiry_pacing', v_title, v_body, v_confidence, v_confidence_score,
        jsonb_build_object(
          'historicalAvg',  v_historical_avg,
          'currentCount',   v_current_count,
          'projectedCount', v_projected,
          'pacingRatio',    round(v_pacing_ratio, 2),
          'yearsAnalyzed',  v_hist_years,
          'dayOfMonth',     v_day_of_month
        ), v_is_actionable)
      on conflict (venue_id, type) do update
        set title = excluded.title, body = excluded.body,
            confidence = excluded.confidence, confidence_score = excluded.confidence_score,
            evidence = excluded.evidence, is_actionable = excluded.is_actionable,
            computed_at = now(), updated_at = now();
    end if;
  end if;

  -- ── 3. Momentum — canonical Lead→Booked (first_booked_at), not clients.created_at ─

  select
    count(*) filter (where first_booked_at >= now() - interval '14 days')::int,
    count(*) filter (where first_booked_at >= now() - interval '28 days'
                      and first_booked_at <  now() - interval '14 days')::int
  into v_recent_bookings, v_prior_bookings
  from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false
    and first_booked_at is not null;

  select
    count(*) filter (where created_at >= now() - interval '14 days')::int,
    count(*) filter (where created_at >= now() - interval '28 days'
                      and created_at <  now() - interval '14 days')::int
  into v_recent_inquiries, v_prior_inquiries
  from leads
  where venue_id = v_venue_id
    and coalesce(exclude_from_business_reporting, false) = false;

  v_booking_accel := case when v_prior_bookings > 0
    then v_recent_bookings::numeric / v_prior_bookings else null end;
  v_inquiry_accel := case when v_prior_inquiries > 0
    then v_recent_inquiries::numeric / v_prior_inquiries else null end;

  if v_recent_bookings >= 2 and (v_prior_bookings = 0 or coalesce(v_booking_accel, 0) >= 1.5) then
    v_confidence_score := least(100,
      40 + v_recent_bookings * 8
      + (case when coalesce(v_booking_accel, 0) >= 2.0 then 20 else 10 end)
    );
    v_confidence := case
      when v_confidence_score >= 70 then 'high'
      when v_confidence_score >= 45 then 'medium'
      else 'low' end;
    v_title := case v_confidence
      when 'high'   then 'Strong booking momentum over the last two weeks'
      when 'medium' then 'Bookings appear to be picking up recently'
      else               'Some early booking momentum this fortnight' end;
    v_body := case v_confidence
      when 'high'   then
        'You''ve booked ' || v_recent_bookings || ' relationship' ||
        (case when v_recent_bookings > 1 then 's' else '' end) || ' in the last 14 days' ||
        (case when v_prior_bookings > 0 then ' — up from ' || v_prior_bookings || ' the prior two weeks' else '' end) ||
        '.'
      when 'medium' then
        'Bookings have picked up recently — ' || v_recent_bookings || ' new booking' ||
        (case when v_recent_bookings > 1 then 's' else '' end) || ' in the past two weeks.'
      else
        'A few bookings have come in recently. Worth nurturing the leads currently in your pipeline.' end;

    insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence, is_actionable)
    values (v_venue_id, 'momentum', v_title, v_body, v_confidence, v_confidence_score,
      jsonb_build_object(
        'recentBookings',      v_recent_bookings,
        'priorBookings',       v_prior_bookings,
        'recentInquiries',     v_recent_inquiries,
        'priorInquiries',      v_prior_inquiries,
        'bookingAcceleration', coalesce(round(v_booking_accel::numeric, 2), null),
        'clock',               'first_booked_at'
      ), false)
    on conflict (venue_id, type) do update
      set title = excluded.title, body = excluded.body,
          confidence = excluded.confidence, confidence_score = excluded.confidence_score,
          evidence = excluded.evidence, is_actionable = excluded.is_actionable,
          computed_at = now(), updated_at = now();

  elsif v_recent_inquiries >= 5 and coalesce(v_inquiry_accel, 0) >= 1.3 then
    v_confidence_score := least(100,
      35 + v_recent_inquiries * 3
      + (case when coalesce(v_inquiry_accel, 0) >= 1.8 then 20 else 10 end)
    );
    v_confidence := case
      when v_confidence_score >= 70 then 'high'
      when v_confidence_score >= 45 then 'medium'
      else 'low' end;
    v_title := case v_confidence
      when 'high'   then 'Inquiry volume has accelerated over the last two weeks'
      when 'medium' then 'Inquiries appear to be picking up recently'
      else               'Some early inquiry momentum this fortnight' end;
    v_body := case v_confidence
      when 'high'   then
        v_recent_inquiries || ' inquiries in the last 14 days — up from ' || v_prior_inquiries ||
        ' the prior two weeks. Stay responsive while momentum is high.'
      when 'medium' then
        'Inquiry volume has picked up recently — ' || v_recent_inquiries ||
        ' inquiries came in over the past two weeks.'
      else
        'A slight uptick in inquiries this fortnight. Worth watching over the coming weeks.' end;

    insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence, is_actionable)
    values (v_venue_id, 'momentum', v_title, v_body, v_confidence, v_confidence_score,
      jsonb_build_object(
        'recentBookings',      v_recent_bookings,
        'priorBookings',       v_prior_bookings,
        'recentInquiries',     v_recent_inquiries,
        'priorInquiries',      v_prior_inquiries,
        'inquiryAcceleration', round(v_inquiry_accel::numeric, 2)
      ), false)
    on conflict (venue_id, type) do update
      set title = excluded.title, body = excluded.body,
          confidence = excluded.confidence, confidence_score = excluded.confidence_score,
          evidence = excluded.evidence, is_actionable = excluded.is_actionable,
          computed_at = now(), updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'cached', false);
end;
$$;

grant execute on function public.compute_venue_insights() to authenticated;

notify pgrst, 'reload schema';
