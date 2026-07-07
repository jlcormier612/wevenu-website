-- Sprint 98: Luv Intelligence Engine
-- Insights are higher-level patterns derived from venue history.
-- Unlike memories (raw facts), insights carry confidence scoring + evidence
-- for explainability and future "Why is Luv saying this?" links.
-- Three types computed: seasonal_concentration, inquiry_pacing, momentum.

create table luv_insights (
  id               uuid        primary key default gen_random_uuid(),
  venue_id         uuid        not null references venues(id) on delete cascade,
  type             text        not null,
  title            text        not null,
  body             text        not null,
  confidence       text        not null check (confidence in ('low', 'medium', 'high')),
  confidence_score int         not null check (confidence_score between 0 and 100),
  evidence         jsonb       not null default '{}',
  computed_at      timestamptz not null default now(),
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (venue_id, type)
);

create index luv_insights_venue_idx on luv_insights (venue_id);

alter table luv_insights enable row level security;

create policy "venues read own insights"
  on luv_insights for select to authenticated
  using (
    venue_id = (select venue_id from venue_users where user_id = auth.uid() limit 1)
  );

-- ── compute_venue_insights ──────────────────────────────────────────────────
-- Derives and upserts all insight types for the current venue.
-- Skips recomputation if any insight is < 24 hours old.
-- Confidence gating logic (score 0–100 → low/medium/high):
--   low    = store only, never surfaced
--   medium = surface with hedged language
--   high   = surface with direct, confident language

create or replace function compute_venue_insights()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id            uuid;

  -- seasonal_concentration
  v_peak_quarter        int;
  v_concentration_pct   int;
  v_years_analyzed      int;
  v_total_bookings      int;

  -- inquiry_pacing
  v_historical_avg      numeric;
  v_hist_years          int;
  v_current_count       int;
  v_day_of_month        int;
  v_days_in_month       int;
  v_projected           int;
  v_pacing_ratio        numeric;

  -- momentum
  v_recent_bookings     int;
  v_prior_bookings      int;
  v_recent_inquiries    int;
  v_prior_inquiries     int;
  v_booking_accel       numeric;
  v_inquiry_accel       numeric;

  -- shared per-insight
  v_confidence_score    int;
  v_confidence          text;
  v_quarter_name        text;
  v_title               text;
  v_body                text;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- Skip if fresh (< 24 hours)
  if exists (
    select 1 from luv_insights
    where venue_id = v_venue_id
      and computed_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'cached', true);
  end if;

  -- ── 1. Seasonal Booking Concentration ─────────────────────────────────────
  -- Which calendar quarter holds the most booked events, and by how much?

  select
    extract(quarter from event_date)::int,
    round(count(*) * 100.0 / sum(count(*)) over())::int,
    count(distinct extract(year from event_date)::int)::int,
    (sum(count(*)) over())::int
  into v_peak_quarter, v_concentration_pct, v_years_analyzed, v_total_bookings
  from clients
  where venue_id = v_venue_id and event_date is not null
  group by extract(quarter from event_date)::int
  order by count(*) desc
  limit 1;

  if v_peak_quarter is not null and v_concentration_pct >= 30 then
    -- Score weights: years of consistency > raw sample > concentration strength
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

    insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence)
    values (v_venue_id, 'seasonal_concentration', v_title, v_body, v_confidence, v_confidence_score,
      jsonb_build_object(
        'peakQuarter',       v_peak_quarter,
        'quarterName',       v_quarter_name,
        'concentrationPct',  v_concentration_pct,
        'yearsAnalyzed',     v_years_analyzed,
        'totalBookings',     v_total_bookings
      ))
    on conflict (venue_id, type) do update
      set title = excluded.title, body = excluded.body,
          confidence = excluded.confidence, confidence_score = excluded.confidence_score,
          evidence = excluded.evidence, computed_at = now(), updated_at = now();
  end if;

  -- ── 2. Inquiry Pacing (current month vs historical baseline) ──────────────
  -- Project current month's inquiry count and compare to prior-year averages.
  -- Only fires on days 7+ (need at least a week of signal).

  select
    coalesce(round(avg(cnt)::numeric, 1), 0),
    count(*)::int
  into v_historical_avg, v_hist_years
  from (
    select extract(year from created_at)::int, count(*) as cnt
    from leads
    where venue_id = v_venue_id
      and extract(month from created_at)::int = extract(month from now())::int
      and extract(year from created_at)::int < extract(year from now())::int
    group by 1
  ) t;

  select count(*)::int into v_current_count
  from leads
  where venue_id = v_venue_id
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

    -- Above average (≥ 25% above baseline)
    if v_pacing_ratio >= 1.25 then
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

    -- Below average (≥ 25% below baseline)
    elsif v_pacing_ratio <= 0.75 then
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
      v_title := null; -- On-track months aren't worth surfacing
    end if;

    if v_title is not null then
      insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence)
      values (v_venue_id, 'inquiry_pacing', v_title, v_body, v_confidence, v_confidence_score,
        jsonb_build_object(
          'historicalAvg',  v_historical_avg,
          'currentCount',   v_current_count,
          'projectedCount', v_projected,
          'pacingRatio',    round(v_pacing_ratio, 2),
          'yearsAnalyzed',  v_hist_years,
          'dayOfMonth',     v_day_of_month
        ))
      on conflict (venue_id, type) do update
        set title = excluded.title, body = excluded.body,
            confidence = excluded.confidence, confidence_score = excluded.confidence_score,
            evidence = excluded.evidence, computed_at = now(), updated_at = now();
    end if;
  end if;

  -- ── 3. Momentum Detection ─────────────────────────────────────────────────
  -- Compare last 14 days vs prior 14 days for bookings and inquiries.
  -- Booking surges take priority over inquiry surges (stronger signal).

  select
    count(*) filter (where created_at >= now() - interval '14 days')::int,
    count(*) filter (where created_at >= now() - interval '28 days'
                      and created_at <  now() - interval '14 days')::int
  into v_recent_bookings, v_prior_bookings
  from clients where venue_id = v_venue_id;

  select
    count(*) filter (where created_at >= now() - interval '14 days')::int,
    count(*) filter (where created_at >= now() - interval '28 days'
                      and created_at <  now() - interval '14 days')::int
  into v_recent_inquiries, v_prior_inquiries
  from leads where venue_id = v_venue_id;

  v_booking_accel := case when v_prior_bookings > 0
    then v_recent_bookings::numeric / v_prior_bookings else null end;
  v_inquiry_accel := case when v_prior_inquiries > 0
    then v_recent_inquiries::numeric / v_prior_inquiries else null end;

  -- Booking surge: ≥2 recent, 50%+ above prior window
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
        'You''ve booked ' || v_recent_bookings || ' event' ||
        (case when v_recent_bookings > 1 then 's' else '' end) || ' in the last 14 days' ||
        (case when v_prior_bookings > 0 then ' — up from ' || v_prior_bookings || ' the prior two weeks' else ' — a strong run' end) ||
        '. The pipeline is moving.'
      when 'medium' then
        'Bookings have picked up recently — ' || v_recent_bookings || ' new event' ||
        (case when v_recent_bookings > 1 then 's' else '' end) || ' in the past two weeks. Encouraging momentum.'
      else
        'A few bookings have come in recently. Worth nurturing the leads currently in your pipeline.' end;

    insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence)
    values (v_venue_id, 'momentum', v_title, v_body, v_confidence, v_confidence_score,
      jsonb_build_object(
        'recentBookings',      v_recent_bookings,
        'priorBookings',       v_prior_bookings,
        'recentInquiries',     v_recent_inquiries,
        'priorInquiries',      v_prior_inquiries,
        'bookingAcceleration', coalesce(round(v_booking_accel::numeric, 2), null)
      ))
    on conflict (venue_id, type) do update
      set title = excluded.title, body = excluded.body,
          confidence = excluded.confidence, confidence_score = excluded.confidence_score,
          evidence = excluded.evidence, computed_at = now(), updated_at = now();

  -- Inquiry surge (only if no booking surge): ≥5 recent, 30%+ above prior
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

    insert into luv_insights (venue_id, type, title, body, confidence, confidence_score, evidence)
    values (v_venue_id, 'momentum', v_title, v_body, v_confidence, v_confidence_score,
      jsonb_build_object(
        'recentBookings',     v_recent_bookings,
        'priorBookings',      v_prior_bookings,
        'recentInquiries',    v_recent_inquiries,
        'priorInquiries',     v_prior_inquiries,
        'inquiryAcceleration', round(v_inquiry_accel::numeric, 2)
      ))
    on conflict (venue_id, type) do update
      set title = excluded.title, body = excluded.body,
          confidence = excluded.confidence, confidence_score = excluded.confidence_score,
          evidence = excluded.evidence, computed_at = now(), updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'cached', false);
end;
$$;

-- ── get_venue_insights ───────────────────────────────────────────────────────

create or replace function get_venue_insights()
returns table (
  id               uuid,
  type             text,
  title            text,
  body             text,
  confidence       text,
  confidence_score int,
  evidence         jsonb,
  computed_at      timestamptz,
  expires_at       timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, type, title, body, confidence, confidence_score, evidence, computed_at, expires_at
  from luv_insights
  where venue_id = (
    select venue_id from venue_users where user_id = auth.uid() limit 1
  )
    and (expires_at is null or expires_at > now())
  order by confidence_score desc;
$$;
