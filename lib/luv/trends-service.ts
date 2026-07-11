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

// ── Story Mode ────────────────────────────────────────────────────────────────

/**
 * Picks ONE named narrative from the venue's trend data.
 * "Here's the story of your business this month" — not a list of metrics.
 *
 * Archetypes (in priority order):
 *   needs_attention  ⚠️  — leads down significantly, worth reviewing
 *   building_momentum 🌟 — leads AND tours both climbing
 *   strong_month     💗  — bookings up or strong revenue
 *   couples_loving   ❤️  — high tour-to-booking conversion
 *   steady           ✨  — neutral / not enough signal
 */
export function computeStoryMode(trends: VenueTrends): LuvObservation | null {
  const { currentMonth: cm, priorMonth: pm, insights } = trends;

  const leadDelta    = delta(cm.leads,              pm.leads);
  const tourDelta    = delta(cm.tours,              pm.tours);
  const bookingDelta = delta(cm.booked,             pm.booked);
  const payDelta     = delta(cm.paymentsCollected,  pm.paymentsCollected);
  const conversion   = insights.avgTourConversionRate;

  // Not enough data — don't surface a story that can't be backed up
  const hasSignal = cm.leads > 0 || cm.tours > 0 || cm.booked > 0;
  if (!hasSignal) return null;

  // Build evidence bullets regardless of archetype
  const evidence: string[] = [];
  if (cm.booked > 0)               evidence.push(`${cm.booked} booking${cm.booked !== 1 ? "s" : ""}`);
  if (cm.tours > 0)                evidence.push(`${cm.tours} tour${cm.tours !== 1 ? "s" : ""}`);
  if (cm.leads > 0)                evidence.push(`${cm.leads} new lead${cm.leads !== 1 ? "s" : ""}`);
  if (cm.paymentsCollected > 0)    evidence.push(dollars(cm.paymentsCollected) + " collected");
  if (conversion !== null && conversion > 0) evidence.push(`${Math.round(conversion)}% tour conversion`);

  // ⚠️ Needs attention — lead volume dropped meaningfully
  if (leadDelta !== null && leadDelta <= -20) {
    return {
      id:            "story_needs_attention",
      priority:      "medium",
      variant:       "story",
      message:       "A few things need your attention.",
      detail:        `Lead volume is down ${Math.abs(leadDelta)}% vs. last month. Worth checking your inquiry sources.`,
      link:          "/leads",
      actionLabel:   "Review leads →",
      storyEvidence: evidence,
    };
  }

  // 🌟 Building momentum — growth in both leads and tours
  if (leadDelta !== null && leadDelta >= 15 && tourDelta !== null && tourDelta >= 15) {
    return {
      id:            "story_building_momentum",
      priority:      "low",
      variant:       "story",
      message:       "You're building momentum.",
      detail:        `Leads up ${leadDelta}% and tours up ${tourDelta}% — both moving in the right direction.`,
      link:          "/dashboard",
      actionLabel:   "View dashboard →",
      storyEvidence: evidence,
    };
  }

  // 💗 Strong month — notable bookings or revenue
  if ((bookingDelta !== null && bookingDelta >= 25) || (payDelta !== null && payDelta >= 20)) {
    const highlight = bookingDelta !== null && bookingDelta >= 25
      ? `Bookings are up ${bookingDelta}% vs. last month.`
      : `Revenue collected is up ${Math.abs(payDelta!)}% vs. last month.`;
    return {
      id:            "story_strong_month",
      priority:      "low",
      variant:       "story",
      message:       "A strong month overall.",
      detail:        highlight,
      link:          "/clients",
      actionLabel:   "View clients →",
      storyEvidence: evidence,
    };
  }

  // ❤️ Couples loving the experience — high conversion quality
  if (conversion !== null && conversion >= 65 && cm.tours >= 3) {
    return {
      id:            "story_couples_loving",
      priority:      "low",
      variant:       "story",
      message:       "Clients are loving the experience.",
      detail:        `Your tour-to-booking rate is ${Math.round(conversion)}% — well above industry average.`,
      link:          "/leads",
      actionLabel:   "View tours →",
      storyEvidence: evidence,
    };
  }

  // ✨ Steady — positive signal but below named-story thresholds
  if (cm.booked > 0 || (leadDelta !== null && leadDelta > 0)) {
    return {
      id:            "story_steady",
      priority:      "low",
      variant:       "story",
      message:       "Things are moving steadily.",
      detail:        cm.booked > 0 ? `${cm.booked} booking${cm.booked !== 1 ? "s" : ""} this month. Keep the momentum going.` : "Inquiries are up. Keep nurturing them.",
      link:          "/dashboard",
      storyEvidence: evidence,
    };
  }

  return null;
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
    positive: pct => `Conversion rate is up ${pct}% — you're booking clients faster than last month.`,
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
