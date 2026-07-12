-- ============================================================================
-- Platform Intelligence Adoption — Phase 1: Repair Existing Luv Infrastructure
--
-- Scope: repair only. No redesign, no extension of the learned layer.
--
-- Live-tested against the actual schema before writing this fix (not
-- assumed from prior documentation, which turned out to be imprecise):
-- compute_venue_insights(), compute_venue_memories(),
-- generate_venue_recommendations(), and compute_venue_health_score() all
-- already execute successfully today — their venue_users-based resolution
-- is not broken, and this migration does not touch them.
--
-- get_venue_trends() (feeding "Story Mode") is the one function confirmed
-- broken, with three distinct, narrow bugs, none of them the venue_users
-- issue prior documentation described:
--   1. Venue resolution queried `venues.user_id`, a column that has never
--      existed (`venues` uses `owner_user_id`) — this alone throws on
--      every call. Fixed by using the existing, already-shared
--      current_user_venue_id() helper, exactly as every sibling Luv
--      function already does.
--   2. Tour metrics queried a `tours` table that doesn't exist — the real
--      table is `tour_appointments`, with `scheduled_at` (not
--      `scheduled_start`).
--   3. Payment metrics queried a nonexistent `invoice_payments` join
--      table — actual collected payments live on `payment_line_items`
--      (`status = 'paid'`, `paid_amount`, `paid_at`), directly venue-
--      scoped, no join needed.
-- Every other computation in the function (leads, day-of-week tour
-- conversion) already referenced real, correct tables/columns and is
-- left untouched.
-- ============================================================================

create or replace function public.get_venue_trends()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id        uuid;
  now_ts            timestamptz := now();

  -- Rolling 30-day windows
  month_start       timestamptz := now_ts - interval '30 days';
  prior_month_start timestamptz := now_ts - interval '60 days';
  prior_month_end   timestamptz := now_ts - interval '30 days';

  -- Rolling 7-day windows
  week_start        timestamptz := now_ts - interval '7 days';
  prior_week_start  timestamptz := now_ts - interval '14 days';
  prior_week_end    timestamptz := now_ts - interval '7 days';

  -- Month metrics
  cm_leads      int; pm_leads      int;
  cm_tours      int; pm_tours      int;
  cm_booked     int; pm_booked     int;
  cm_payments   numeric; pm_payments   numeric;

  -- Week metrics
  cw_leads      int; pw_leads      int;
  cw_tours      int; pw_tours      int;

  -- Day-of-week insight
  best_day      text;
  best_day_rate numeric;
  avg_dow_rate  numeric;
begin
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is null then
    return '{"error":"no_venue"}'::jsonb;
  end if;

  -- ── Month: leads (inquiries) ───────────────────────────────────────────────
  select count(*) into cm_leads from leads
  where venue_id = v_venue_id and created_at >= month_start;

  select count(*) into pm_leads from leads
  where venue_id = v_venue_id and created_at >= prior_month_start and created_at < prior_month_end;

  -- ── Month: tours booked ────────────────────────────────────────────────────
  select count(*) into cm_tours from tour_appointments
  where venue_id = v_venue_id and created_at >= month_start;

  select count(*) into pm_tours from tour_appointments
  where venue_id = v_venue_id and created_at >= prior_month_start and created_at < prior_month_end;

  -- ── Month: bookings (leads won) ────────────────────────────────────────────
  select count(*) into cm_booked from leads
  where venue_id = v_venue_id and status = 'won'
    and updated_at >= month_start;

  select count(*) into pm_booked from leads
  where venue_id = v_venue_id and status = 'won'
    and updated_at >= prior_month_start and updated_at < prior_month_end;

  -- ── Month: payments collected ──────────────────────────────────────────────
  select coalesce(sum(paid_amount), 0) into cm_payments
  from payment_line_items
  where venue_id = v_venue_id and status = 'paid' and paid_at >= month_start;

  select coalesce(sum(paid_amount), 0) into pm_payments
  from payment_line_items
  where venue_id = v_venue_id and status = 'paid' and paid_at >= prior_month_start and paid_at < prior_month_end;

  -- ── Week: leads ────────────────────────────────────────────────────────────
  select count(*) into cw_leads from leads
  where venue_id = v_venue_id and created_at >= week_start;

  select count(*) into pw_leads from leads
  where venue_id = v_venue_id and created_at >= prior_week_start and created_at < prior_week_end;

  -- ── Week: tours ────────────────────────────────────────────────────────────
  select count(*) into cw_tours from tour_appointments
  where venue_id = v_venue_id and created_at >= week_start;

  select count(*) into pw_tours from tour_appointments
  where venue_id = v_venue_id and created_at >= prior_week_start and created_at < prior_week_end;

  -- ── Day-of-week tour conversion insight (all-time, completed tours only) ───
  with dow_stats as (
    select
      trim(to_char(t.scheduled_at at time zone 'UTC', 'Day')) as day_name,
      count(*)                                     as total,
      count(*) filter (where l.status = 'won')     as converted
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
      count(*)                                  as total,
      count(*) filter (where l.status = 'won') as converted
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

notify pgrst, 'reload schema';
