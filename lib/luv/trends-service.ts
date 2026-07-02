import { createClient } from "@/integrations/supabase/server";
import type { LuvObservation } from "@/lib/luv/types";
import type { VenueTrends } from "./trends-types";

// ── DB fetch ──────────────────────────────────────────────────────────────────

export async function getVenueTrends(): Promise<VenueTrends | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_trends");
  if (error || !data || (data as { error?: string }).error) return null;
  return data as VenueTrends;
}

// ── Delta helpers ─────────────────────────────────────────────────────────────

/** Returns % change, or null when prior data is too thin to be meaningful. */
function delta(current: number, prior: number): number | null {
  if (prior < 2) return null;
  return Math.round(((current - prior) / prior) * 100);
}

function dollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}

// ── Observation factory ───────────────────────────────────────────────────────

type TrendSpec = {
  id:       string;
  current:  number;
  prior:    number;
  // Higher is better for positive framing (e.g. leads, bookings, revenue)
  higherIsBetter: boolean;
  threshold: number; // minimum % change to surface an observation
  positive: (pct: number) => string;
  warning:  (pct: number) => string;
  link:     string;
  positiveLabel?: string;
  warningLabel?:  string;
};

function makeTrendObs(spec: TrendSpec): LuvObservation | null {
  const d = delta(spec.current, spec.prior);
  if (d === null || Math.abs(d) < spec.threshold) return null;

  const isPositive = spec.higherIsBetter ? d > 0 : d < 0;
  const absPct = Math.abs(d);

  return {
    id:          spec.id,
    priority:    isPositive ? "low" : "medium",
    message:     isPositive ? spec.positive(absPct) : spec.warning(absPct),
    link:        spec.link,
    actionLabel: isPositive ? (spec.positiveLabel ?? "View →") : (spec.warningLabel ?? "Review →"),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeTrendObservations(trends: VenueTrends): LuvObservation[] {
  const obs: (LuvObservation | null)[] = [];
  const { currentMonth: cm, priorMonth: pm, currentWeek: cw, priorWeek: pw, insights } = trends;

  // 1. Weekly inquiry trend (leading indicator — show first)
  obs.push(makeTrendObs({
    id:             "trend_weekly_leads",
    current:        cw.leads,
    prior:          pw.leads,
    higherIsBetter: true,
    threshold:      20,
    positive: pct => `Inquiries are up ${pct}% this week — momentum is building.`,
    warning:  pct => `Inquiry volume is down ${pct}% compared to last week.`,
    link:           "/leads",
    warningLabel:   "Check pipeline →",
  }));

  // 2. Monthly inquiry trend
  obs.push(makeTrendObs({
    id:             "trend_month_leads",
    current:        cm.leads,
    prior:          pm.leads,
    higherIsBetter: true,
    threshold:      15,
    positive: pct => `Inquiries are up ${pct}% vs. last month. You're on a great run.`,
    warning:  pct => `Inquiry volume dropped ${pct}% vs. last month. Worth reviewing your lead sources.`,
    link:           "/leads",
    warningLabel:   "View leads →",
  }));

  // 3. Tour booking trend (weekly)
  obs.push(makeTrendObs({
    id:             "trend_weekly_tours",
    current:        cw.tours,
    prior:          pw.tours,
    higherIsBetter: true,
    threshold:      25,
    positive: pct => `Tour bookings are up ${pct}% this week.`,
    warning:  pct => `Fewer tours are being booked this week — down ${pct}%.`,
    link:           "/leads?filter=touring",
    warningLabel:   "Review tours →",
  }));

  // 4. Monthly tour trend
  obs.push(makeTrendObs({
    id:             "trend_month_tours",
    current:        cm.tours,
    prior:          pm.tours,
    higherIsBetter: true,
    threshold:      20,
    positive: pct => `Tour attendance is up ${pct}% this month — your availability is working.`,
    warning:  pct => `Tour bookings fell ${pct}% this month. Check your available slots.`,
    link:           "/settings",
    warningLabel:   "Tour settings →",
  }));

  // 5. Monthly booking (conversion) trend
  obs.push(makeTrendObs({
    id:             "trend_month_booked",
    current:        cm.booked,
    prior:          pm.booked,
    higherIsBetter: true,
    threshold:      20,
    positive: pct => `Conversion rate is up ${pct}% — you're booking couples faster than last month.`,
    warning:  pct => `Conversions are down ${pct}% vs. last month.`,
    link:           "/leads",
  }));

  // 6. Monthly payment collection trend
  if (cm.paymentsCollected > 0 || pm.paymentsCollected > 0) {
    obs.push(makeTrendObs({
      id:             "trend_month_payments",
      current:        cm.paymentsCollected,
      prior:          pm.paymentsCollected,
      higherIsBetter: true,
      threshold:      20,
      positive: pct => `Revenue collected is up ${pct}% this month (${dollars(cm.paymentsCollected)} total).`,
      warning:  pct => `Payment collection is down ${pct}% vs. last month — ${dollars(cm.paymentsCollected)} collected.`,
      link:           "/clients",
      warningLabel:   "Review payments →",
    }));
  }

  // 7. Day-of-week tour insight (only if best day is meaningfully better than average)
  const { bestTourDay, bestTourDayRate, avgTourConversionRate } = insights;
  if (
    bestTourDay &&
    bestTourDayRate !== null &&
    avgTourConversionRate !== null &&
    avgTourConversionRate > 0 &&
    bestTourDayRate >= avgTourConversionRate * 1.4
  ) {
    const multiplier = (bestTourDayRate / avgTourConversionRate).toFixed(1);
    obs.push({
      id:          "trend_best_tour_day",
      priority:    "low",
      message:     `${bestTourDay} tours convert at ${bestTourDayRate}% — ${multiplier}× better than your average. Consider prioritizing them.`,
      link:        "/settings",
      actionLabel: "Tour settings →",
    });
  }

  return obs.filter((o): o is LuvObservation => o !== null);
}
