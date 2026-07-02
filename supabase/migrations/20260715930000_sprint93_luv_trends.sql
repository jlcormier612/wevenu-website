-- Sprint 93: Luv Trend Intelligence
-- get_venue_trends() returns period-over-period metrics so Luv can say
-- "Inquiries are up 24%" or "Tour attendance fell 18%."
--
-- Returns:
--   currentMonth / priorMonth  — rolling 30d vs. prior 30d
--   currentWeek  / priorWeek   — rolling 7d vs. prior 7d
--   insights                   — day-of-week tour conversion analysis

CREATE OR REPLACE FUNCTION get_venue_trends()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venue_id        UUID;
  now_ts            TIMESTAMPTZ := now();

  -- Rolling 30-day windows
  month_start       TIMESTAMPTZ := now_ts - INTERVAL '30 days';
  prior_month_start TIMESTAMPTZ := now_ts - INTERVAL '60 days';
  prior_month_end   TIMESTAMPTZ := now_ts - INTERVAL '30 days';

  -- Rolling 7-day windows
  week_start        TIMESTAMPTZ := now_ts - INTERVAL '7 days';
  prior_week_start  TIMESTAMPTZ := now_ts - INTERVAL '14 days';
  prior_week_end    TIMESTAMPTZ := now_ts - INTERVAL '7 days';

  -- Month metrics
  cm_leads      INT; pm_leads      INT;
  cm_tours      INT; pm_tours      INT;
  cm_booked     INT; pm_booked     INT;
  cm_payments   NUMERIC; pm_payments   NUMERIC;

  -- Week metrics
  cw_leads      INT; pw_leads      INT;
  cw_tours      INT; pw_tours      INT;

  -- Day-of-week insight
  best_day      TEXT;
  best_day_rate NUMERIC;
  avg_dow_rate  NUMERIC;
BEGIN
  SELECT id INTO v_venue_id
  FROM venues
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"error":"no_venue"}'::JSONB;
  END IF;

  -- ── Month: leads (inquiries) ───────────────────────────────────────────────
  SELECT COUNT(*) INTO cm_leads FROM leads
  WHERE venue_id = v_venue_id AND created_at >= month_start;

  SELECT COUNT(*) INTO pm_leads FROM leads
  WHERE venue_id = v_venue_id AND created_at >= prior_month_start AND created_at < prior_month_end;

  -- ── Month: tours booked ────────────────────────────────────────────────────
  SELECT COUNT(*) INTO cm_tours FROM tours
  WHERE venue_id = v_venue_id AND created_at >= month_start;

  SELECT COUNT(*) INTO pm_tours FROM tours
  WHERE venue_id = v_venue_id AND created_at >= prior_month_start AND created_at < prior_month_end;

  -- ── Month: bookings (leads won) ────────────────────────────────────────────
  SELECT COUNT(*) INTO cm_booked FROM leads
  WHERE venue_id = v_venue_id AND status = 'won'
    AND updated_at >= month_start;

  SELECT COUNT(*) INTO pm_booked FROM leads
  WHERE venue_id = v_venue_id AND status = 'won'
    AND updated_at >= prior_month_start AND updated_at < prior_month_end;

  -- ── Month: payments collected ──────────────────────────────────────────────
  SELECT COALESCE(SUM(ip.amount), 0) INTO cm_payments
  FROM invoice_payments ip
  JOIN invoices inv ON inv.id = ip.invoice_id
  WHERE inv.venue_id = v_venue_id AND ip.paid_at >= month_start;

  SELECT COALESCE(SUM(ip.amount), 0) INTO pm_payments
  FROM invoice_payments ip
  JOIN invoices inv ON inv.id = ip.invoice_id
  WHERE inv.venue_id = v_venue_id AND ip.paid_at >= prior_month_start AND ip.paid_at < prior_month_end;

  -- ── Week: leads ────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO cw_leads FROM leads
  WHERE venue_id = v_venue_id AND created_at >= week_start;

  SELECT COUNT(*) INTO pw_leads FROM leads
  WHERE venue_id = v_venue_id AND created_at >= prior_week_start AND created_at < prior_week_end;

  -- ── Week: tours ────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO cw_tours FROM tours
  WHERE venue_id = v_venue_id AND created_at >= week_start;

  SELECT COUNT(*) INTO pw_tours FROM tours
  WHERE venue_id = v_venue_id AND created_at >= prior_week_start AND created_at < prior_week_end;

  -- ── Day-of-week tour conversion insight (all-time, completed tours only) ───
  WITH dow_stats AS (
    SELECT
      TRIM(TO_CHAR(t.scheduled_start AT TIME ZONE 'UTC', 'Day')) AS day_name,
      COUNT(*)                                                     AS total,
      COUNT(*) FILTER (WHERE l.status = 'won')                    AS converted
    FROM tours t
    LEFT JOIN leads l ON l.id = t.lead_id
    WHERE t.venue_id = v_venue_id
      AND t.status = 'completed'
    GROUP BY day_name
    HAVING COUNT(*) >= 3
  ),
  ranked AS (
    SELECT *,
      ROUND(converted::NUMERIC / NULLIF(total, 0) * 100) AS rate
    FROM dow_stats
  )
  SELECT day_name, rate
  INTO best_day, best_day_rate
  FROM ranked
  ORDER BY rate DESC
  LIMIT 1;

  SELECT ROUND(
    SUM(converted)::NUMERIC / NULLIF(SUM(total), 0) * 100
  ) INTO avg_dow_rate
  FROM (
    SELECT
      COUNT(*)                                     AS total,
      COUNT(*) FILTER (WHERE l.status = 'won')    AS converted
    FROM tours t
    LEFT JOIN leads l ON l.id = t.lead_id
    WHERE t.venue_id = v_venue_id AND t.status = 'completed'
  ) sub;

  RETURN jsonb_build_object(
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
END;
$$;

GRANT EXECUTE ON FUNCTION get_venue_trends() TO authenticated;
